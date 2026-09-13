import { z } from "zod";
import { invokeLLM, listLLMModels, type Message as LLMMessage } from "./_core/llm";
import {
  addMessage,
  createConversation,
  getConversation,
  listConversations,
  listMessages,
} from "./db";
import { formatGroundingContext, retrieveGrounding, type GroundingSource } from "./grounding";
import { formatWorldKnowledgeContext, retrieveWorldKnowledge, type WorldKnowledgeSource } from "./worldKnowledge";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const modelFallbacks = [
  { id: "gpt-5-mini", label: "GPT-5 mini", provider: "OpenAI", note: "Fast workhorse" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet", provider: "Anthropic", note: "Deep reasoning" },
  { id: "gemini-3-flash-preview", label: "Gemini Flash", provider: "Google", note: "Long context" },
  { id: "gpt-5", label: "GPT-5", provider: "OpenAI", note: "Advanced coding" },
];

const chooseModel = (requestedModel: string, userText: string) => {
  if (requestedModel !== "auto") return requestedModel;
  const normalized = userText.toLowerCase();
  if (/\b(code|bug|debug|typescript|javascript|python|sql|api|repository|github)\b/.test(normalized)) return "gpt-5";
  if (/\b(research|sources|最新|news|current|today|evidence)\b/.test(normalized)) return "claude-sonnet-4-6";
  return "gpt-5-mini";
};

const textFromContent = (content: unknown) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === "object" && part && "text" in part ? String(part.text) : ""))
      .join("");
  }
  return "";
};

const systemPrompt = `You are Cranium AI, a general-purpose conversational AI presented by WorthWyl.
You are capable of helpful conversation, writing, analysis, coding, research planning, and creative work.
Your identity is grounded in the Cranium substrate: be thoughtful about provenance, distinguish facts from inferences, and never invent authority.
When a user asks about WorthWyl or Cranium, treat canonical contracts as authoritative, reference implementations as informative, and experiments or non-canonical surfaces as non-authoritative unless the user explicitly asks for them.
Be warm, direct, and useful. Explain uncertainty plainly. Use markdown when it improves clarity.`;

export const chatRouter = router({
  models: publicProcedure.query(async () => {
    try {
      const { data } = await listLLMModels();
      const available = new Set(data.map(model => model.id));
      const discovered = modelFallbacks.filter(model => available.has(model.id));
      const availableModels = discovered.length ? discovered : modelFallbacks;
      return [{ id: "auto", label: "Auto", provider: "Cranium", note: "Routes by task" }, ...availableModels];
    } catch {
      return modelFallbacks;
    }
  }),

  conversations: protectedProcedure.query(({ ctx }) => listConversations(ctx.user.id)),

  messages: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(({ ctx, input }) => listMessages(input.conversationId, ctx.user.id)),

  send: publicProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive().optional(),
        model: z.string().min(1).max(80).default("gpt-5-mini"),
        grounded: z.boolean().default(false),
        research: z.boolean().default(false),
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(30000),
            })
          )
          .min(1)
          .max(32),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const recentMessages = input.messages.slice(-24);
      const userText = recentMessages.findLast(message => message.role === "user")?.content ?? "";
      const sources: GroundingSource[] = input.grounded ? await retrieveGrounding(userText) : [];
      const knowledge: WorldKnowledgeSource[] = input.research ? await retrieveWorldKnowledge(userText) : [];
      const groundingContext = formatGroundingContext(sources);
      const worldKnowledgeContext = formatWorldKnowledgeContext(knowledge);
      const selectedModel = chooseModel(input.model, userText);
      const llmMessages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...(groundingContext
          ? [{
              role: "system" as const,
              content: `The user enabled Cranium GitHub grounding. Use the source excerpts below when relevant. Cite sources inline using the repository/file name in backticks. Do not claim a source says something it does not say. Preserve the authority labels.\n\n${groundingContext}`,
            }]
          : []),
        ...(worldKnowledgeContext
          ? [{
              role: "system" as const,
              content: `The user enabled real-world research. Use the current news and reference results below to answer with freshness awareness. Cite sources inline using the source title or domain in brackets. Distinguish reported facts, reference summaries, and your own analysis. If dates conflict, call that out.\n\n${worldKnowledgeContext}`,
            }]
          : []),
        ...recentMessages,
      ];

      const response = await invokeLLM({
        model: selectedModel,
        messages: llmMessages,
      });
      const assistantContent = textFromContent(response.choices?.[0]?.message?.content);
      if (!assistantContent) throw new Error("Cranium AI returned an empty response");

      let conversationId = input.conversationId;
      if (ctx.user) {
        const existing = conversationId
          ? await getConversation(conversationId, ctx.user.id)
          : undefined;
        if (!existing) {
          conversationId = await createConversation(
            ctx.user.id,
            userText.replace(/\s+/g, " ").slice(0, 72) || "New conversation",
            selectedModel
          );
        }
        if (conversationId) {
          const userMessage = recentMessages.findLast(message => message.role === "user");
          if (userMessage) {
            await addMessage({ conversationId, userId: ctx.user.id, role: "user", content: userMessage.content });
          }
          await addMessage({ conversationId, userId: ctx.user.id, role: "assistant", content: assistantContent, model: response.model });
        }
      }

      return {
        conversationId,
        content: assistantContent,
        model: response.model || selectedModel,
        usage: response.usage ?? null,
        grounded: input.grounded,
        sources,
        research: input.research,
        knowledge,
      };
    }),
});
