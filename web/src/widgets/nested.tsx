import { LLMDescribe } from "./llm-describe";

export const Nested = () => {
  return (
    <LLMDescribe content="deep">
      <div>nested</div>
    </LLMDescribe>
  );
};
