# Conversation Orchestrator — 接口设计 v1

**定位**: 新增组件，位于新的 `/api/chat` 入口与四个既有 Service 之间。**不修改** `ExtractionService`
/ `ConfirmationService` / `ConflictDetectionService` / `QuestionerService` 的任何公开签名——已对照源码核实，
这四个 Service 的现有接口足够支撑本设计，改动只发生在编排层与呈现层。

```
POST /api/chat
      │
      ▼
ConversationOrchestrator.handleTurn()
      │
      ├─ ExtractionService.extract()              [不变]
      ├─ ConflictDetectionService.detect()         [不变]
      ├─ QuestionerService.run()                   [不变]
      ├─ ConfirmationService.*                     [不变]
      │
      ├─ IntentResolver          [新增]
      ├─ ResponseComposer        [新增]
      └─ PendingSlotStore        [新增]
```

---

## 1. 入口类型

```ts
interface OrchestratorTurnInput {
  userId: string;
  message: string;                 // 用户本轮原话
  history: ConversationTurn[];     // 最近若干轮，仅用于 Composer 组织语气/上下文，不是独立的 session 概念
}

interface ConversationTurn {
  role: 'user' | 'mirror';
  content: string;
  createdAt: string;
}

interface OrchestratorTurnOutput {
  reply: string;                   // 呈现给用户的最终回复（已融合观察/推测/提问，若有）
  slot: PendingSlot | null;        // 本轮结束后"悬而未决"的一项，供下一轮 IntentResolver 使用
  sideEffects: TurnSideEffect[];   // 本轮实际发生的状态变更，供日志/Thought Space 展示用，不面向对话文本
}
```

---

## 2. PendingSlot —— "队列深度 = 1" 的落地

Confirmation Protocol v2 第 2 章要求"同一时刻最多一件事悬而未决"，且这个名额由 Interpretation 确认与
Questioner 的问题**共用**。用一个可辨类型（discriminated union）表达：

```ts
type PendingSlot =
  | { kind: 'interpretation_confirm'; interpretationId: string; presentedConfidence: number }
  | {
      kind: 'thought_wording_confirm';
      interpretationId: string;
      draftContent: string;
      draftLatticeLevel: number;              // LatticeClassifier 的分类结果，随 slot 一起产生，见 §6.1
      draftLatticeLevelsSecondary?: number[];
    }
  | { kind: 'question'; questionId: string }
  | { kind: 'clarify_retry'; original: PendingSlot; askedAt: string }; // 歧义兜底，见 §4
```

`thought_wording_confirm` 这个 slot 一旦创建，坐标已经由 `LatticeClassifier` 算好并附在 slot 上（见 §6.1），
对话里只需要用户确认转写措辞，不问坐标。

`thought_wording_confirm` 对应 Protocol v2 第 6 章"存为 Thought"的第二步确认——现有
`ConfirmationService.confirmInterpretation(id, 'store', { thoughtContent, latticeLevel })`
要求转写文本和坐标**在同一次调用里**给出，所以对话里"认同存起来"和"转写措辞确认"必须拆成
两个 Orchestrator 回合，第二回合拿到用户认可的措辞后才真正调用 `confirmInterpretation`。

`PendingSlotStore` 是新增的最小持久化接口，每个用户一条：

```ts
interface PendingSlotStore {
  get(userId: string): PendingSlot | null;
  set(userId: string, slot: PendingSlot | null): void;
}
```

---

## 3. 主流程

```ts
class ConversationOrchestrator {
  constructor(
    private extraction: ExtractionService,
    private confirmation: ConfirmationService,
    private conflictDetection: ConflictDetectionService,
    private questioner: QuestionerService,
    private composer: ResponseComposer,
    private intentResolver: IntentResolver,
    private slots: PendingSlotStore,
    private logger: Logger,
  ) {}

  async handleTurn(input: OrchestratorTurnInput): Promise<OrchestratorTurnOutput> {
    const effects: TurnSideEffect[] = [];
    const currentSlot = this.slots.get(input.userId);

    // Step 1 — 若上一轮留了悬而未决的一项，先尝试解析本轮用户话语的意图
    let resolvedSlot: PendingSlot | null = null;
    if (currentSlot) {
      const action = await this.intentResolver.resolve(currentSlot, input.message);
      resolvedSlot = await this.applyAction(currentSlot, action, input.userId, effects);
    }

    // Step 2 — 静默运行 Extraction（数据层，始终执行，不受节奏影响）
    const extracted = await this.extraction.extract(input.userId, input.message);

    // Step 3 — 对新 Interpretation 静默跑冲突检测（不面向用户，只落库 challenges）
    for (const interp of extracted.interpretations) {
      await this.conflictDetection.detect(interp.id); // 源码签名：detect(interpretationId: string)，单参数
    }

    // Step 4 — 若队列名额空闲（resolvedSlot 为 null），决定下一个候选
    const nextSlot = resolvedSlot ?? this.pickNextSlot(extracted, input.userId);

    // Step 5 — 若队列仍空闲，顺带跑一次 Questioner（内部已按阈值/队列自我节流，可安全每轮调用）
    const questionerResult = nextSlot ? null : await this.questioner.run(input.userId);
    const finalSlot = nextSlot ?? this.slotFromQuestioner(questionerResult);

    // Step 6 — 组织自然语言回复（是否真的把 finalSlot 编织进本轮回复，由 Composer 判断"自然时机"）
    const composed = await this.composer.compose({
      history: input.history,
      userMessage: input.message,
      observationsToMention: extracted.observations,   // 客观陈述：允许顺带提及，不占用 slot
      candidateSlot: finalSlot,
    });

    this.slots.set(input.userId, composed.deferredSlot ?? finalSlot ?? null);
    return { reply: composed.reply, slot: composed.deferredSlot ?? finalSlot ?? null, sideEffects: effects };
  }
}
```

---

## 4. IntentResolver —— 自然语言 → 状态机动作

对应 Protocol v2 第 4 章的映射表：

```ts
type ConfirmationAction =
  | { action: 'confirm_no_store' }                          // 认同，先不存
  | { action: 'confirm_and_store_intent' }                   // 认同，存起来（触发下一轮措辞确认）
  | { action: 'reject'; rebuttal?: string }                  // 不是这样，其实是…
  | { action: 'wording_ok' }                                 // 对 thought_wording_confirm：转写准确
  | { action: 'wording_edit'; content: string }               // 仅措辞调整
  | { action: 'question_answered' }                           // 用户直接回答了问题 → open
  | { action: 'question_dismiss' }                            // "不用了"
  | { action: 'no_response' }                                 // 明显在谈别的事，未表态
  | { action: 'unclear' };                                    // 无法归类

interface IntentResolver {
  resolve(slot: PendingSlot, userMessage: string): Promise<ConfirmationAction>;
}
```

`applyAction` 把 `ConfirmationAction` 落到具体 Service 调用（示意，未列全所有分支）：

```ts
async function applyAction(slot, action, userId, effects): Promise<PendingSlot | null> {
  switch (slot.kind) {
    case 'interpretation_confirm':
      if (action.action === 'confirm_no_store') {
        confirmation.confirmInterpretation(slot.interpretationId, 'skip');
        effects.push({ type: 'interpretation_confirmed', interpretationId: slot.interpretationId, storedAsThought: false });
        return null; // 名额释放
      }
      if (action.action === 'confirm_and_store_intent') {
        const draft = /* 转写为陈述句，调用 LLM 或复用 Interpretation.content 规则 */;
        const lattice = await latticeClassifier.classify({
          content: draft,
          evidenceQuotes: /* 该 Interpretation 关联的 evidence 原文 */,
        });
        return {
          kind: 'thought_wording_confirm',
          interpretationId: slot.interpretationId,
          draftContent: draft,
          draftLatticeLevel: lattice.latticeLevel,
          draftLatticeLevelsSecondary: lattice.latticeLevelsSecondary,
        };
      }
      if (action.action === 'reject') {
        confirmation.confirmInterpretation(slot.interpretationId, 'reject', { rebuttal: action.rebuttal });
        effects.push({ type: 'interpretation_rejected', interpretationId: slot.interpretationId, rebuttal: action.rebuttal });
        return null;
      }
      if (action.action === 'unclear') return { kind: 'clarify_retry', original: slot, askedAt: new Date().toISOString() };
      return slot; // no_response：保持排队

    case 'thought_wording_confirm':
      if (action.action === 'wording_ok' || action.action === 'wording_edit') {
        const content = action.action === 'wording_edit' ? action.content : slot.draftContent;
        const { thought } = confirmation.confirmInterpretation(slot.interpretationId, 'store', {
          thoughtContent: content,
          latticeLevel: slot.draftLatticeLevel,                       // 大模型已在 slot 创建时分类完毕
          latticeLevelsSecondary: slot.draftLatticeLevelsSecondary,
        });
        effects.push({ type: 'thought_created', thoughtId: thought!.id });
        return null;
      }
      // wording_edit 实质性改写了论断内容（不只是措辞）时，应转 §5（Protocol v2）"实质改写"分支，
      // 而不是直接当作 wording 处理——这里的判断同样交给 IntentResolver 在 resolve() 阶段完成分类。
      return slot;

    case 'question':
      if (action.action === 'question_answered') { /* 语义上 Question 不需要 confirm，用户已直接回答 */ return null; }
      if (action.action === 'question_dismiss') { confirmation.rejectQuestion(slot.questionId); return null; }
      return slot;

    case 'clarify_retry':
      // 已经追问过一次：无论这次是否 unclear，都不再追问第二次
      return action.action === 'unclear' ? slot.original /* 打回排队，不再追问 */ : /* 递归按 slot.original.kind 处理一次 */;
  }
}
```

---

## 5. ResponseComposer —— "自然时机"判断放在这里，不做成独立规则引擎

是否真的把 `candidateSlot` 编织进本轮回复（还是继续排队，等更自然的时机），交给 Composer 内部的一次
LLM 调用去判断话题衔接度，而不是写死一套关键词/相似度规则——这类"是否自然"的判断本质上就是语言理解问题，
硬编码规则大概率会显得生硬。Composer 的契约只约定输入输出，不约定内部怎么判断：

```ts
interface ComposeInput {
  history: ConversationTurn[];
  userMessage: string;
  observationsToMention: Observation[];  // 允许顺带提及，可多条，不占用 slot
  candidateSlot: PendingSlot | null;     // 队列中排着的下一项（可能是接着上一轮的 clarify_retry）
}

interface ComposeOutput {
  reply: string;
  /** 若本轮判断"现在不是自然时机"，把 candidateSlot 原样放回队列，不呈现；
   *  否则为 null，交由调用方把 candidateSlot 当作已呈现处理。 */
  deferredSlot: PendingSlot | null;
}

interface ResponseComposer {
  compose(input: ComposeInput): Promise<ComposeOutput>;
}
```

---

## 6. LatticeClassifier —— 晶格坐标由大模型判定

**决定**：不在对话里问用户"这更像哪一类想法"，由模型在 `thought_wording_confirm` slot 创建时静默分类，
用户只确认转写措辞是否准确，不参与坐标判定。

这个决定站得住的理由：`specs/concepts/Thought.md` 里 12 个晶格编码分类的是**这句话本身属于哪个哲学/意识频段**
（本体假设、终极关切、自我解释……），不是对用户人格/思想水平的评判，不落在 S-6.3"禁止人格标签化"管的范围内——
它更接近给一段文本打主题分类，而不是给一个人打标签。

```ts
interface LatticeClassifier {
  classify(input: {
    content: string;             // 已转写的陈述句
    evidenceQuotes: string[];    // 该 Interpretation 关联的 evidence 原文，帮助模型判断语境
  }): Promise<{
    latticeLevel: number;                // 1-12 主坐标
    latticeLevelsSecondary?: number[];   // 可选次坐标，不含与主坐标相同的值
    rationale: string;                   // 仅入结构化日志，不面向用户呈现
  }>;
}
```

**分类出错怎么办**：坐标只影响 Thought Space 里的索引/图谱聚合位置，不改变 Thought 本身的内容，出错的代价
远低于内容判断出错，所以不需要在对话里堵一道确认关卡。但 Thought Space 应该给一个"重新归类"的入口（后续再设计
UI，不阻塞本次接口），让用户之后发现分类不准时可以自己改，这样与 Article 6"允许随时修改"的精神保持一致，
只是修改的时机从"存入前"挪到了"存入后按需修正"。

---

## 7. 尚未解决、需要你决定的两个问题

1. **PendingSlotStore 落在哪**——可以是新表，也可以先用一个内存 Map（单进程、Phase 1 单用户场景够用），
   等真正要支持多设备同步时再落库。建议先用内存版，避免为了一个还没验证的交互模型先去改 schema。
2. **`clarify_retry` 之后仍然 unclear 怎么处理**——设计里是"打回排队，不再追问"，但这意味着这条
   Interpretation 可能长期停在 pending，用户也不会在 Thought Space 之外的地方看到它。要不要在 Thought Space
   的 Review 入口里给这类"问过一次没答上"的项目一个显式列表，避免彻底沉底？

这三个问题不影响接口本身的形状，但会影响 `applyAction` 和 `pickNextSlot` 里具体怎么写，建议先确认再进代码。
