import { createAdminClient } from "@/lib/supabase/admin";

export type PublicProductQuestion = {
  answerText: string;
  answeredAt: string | null;
  customerName: string;
  id: string;
  questionText: string;
};

type ProductQuestionRow = {
  answer_text: string | null;
  answered_at: string | null;
  customer_name: string | null;
  id: string;
  question_text: string;
};

export async function getApprovedProductQuestions({
  productId,
  storeId
}: {
  productId: string;
  storeId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data } = await admin
    .from("product_questions" as never)
    .select("id, customer_name, question_text, answer_text, answered_at")
    .eq("store_id" as never, storeId as never)
    .eq("product_id" as never, productId as never)
    .eq("status" as never, "approved" as never)
    .not("answer_text" as never, "is", null)
    .order("answered_at" as never, { ascending: false } as never)
    .limit(20);

  return ((data ?? []) as unknown as ProductQuestionRow[])
    .filter((question) => Boolean(question.answer_text?.trim()))
    .map((question) => ({
      answerText: question.answer_text?.trim() ?? "",
      answeredAt: question.answered_at,
      customerName: question.customer_name?.trim() || "Customer",
      id: question.id,
      questionText: question.question_text
    }));
}
