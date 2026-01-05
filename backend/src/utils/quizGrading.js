function normalizeText(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function gradeQuestion(question, userAnswer) {
  switch (question.type) {
    case "mcq": {
      const idx = Number(userAnswer);
      if (!Number.isInteger(idx) || idx < 0 || idx > 3) return { isCorrect: false };
      return { isCorrect: idx === question.answerIndex };
    }
    case "true_false": {
      if (typeof userAnswer !== "boolean") return { isCorrect: false };
      return { isCorrect: userAnswer === question.answer };
    }
    case "fill_blank": {
      const ans = normalizeText(userAnswer);
      const expected = normalizeText(question.answer);
      if (!ans) return { isCorrect: false };
      return { isCorrect: ans === expected };
    }
    case "short_answer": {
      // Short answers are hard to auto-grade reliably from text alone.
      // We still enforce non-empty input and return the model answer for feedback.
      const ans = normalizeText(userAnswer);
      if (!ans) return { isCorrect: false };
      return { isCorrect: null };
    }
    default:
      return { isCorrect: null };
  }
}

function validateNonEmptyAnswer(question, userAnswer) {
  if (question.type === "mcq") {
    const idx = Number(userAnswer);
    if (!Number.isInteger(idx)) return "Answer must be an integer option index";
    if (idx < 0 || idx > 3) return "Answer must be between 0 and 3";
    return null;
  }
  if (question.type === "true_false") {
    if (typeof userAnswer !== "boolean") return "Answer must be boolean";
    return null;
  }
  // fill_blank + short_answer
  const s = String(userAnswer ?? "").trim();
  if (!s) return "Answer cannot be empty";
  return null;
}

module.exports = { gradeQuestion, validateNonEmptyAnswer };

