/** 화면 표시용 번호 라벨. 번호 자체는 서버가 부여한 안정 번호다. */
export const inputLabel = (number: number) => `IN-${number}`;

export const itemLabel = (kind: "DECISION" | "REQUIREMENT", number: number) =>
  `${kind === "DECISION" ? "D" : "R"}-${number}`;

export const questionLabel = (number: number) => `Q-${number}`;
