import { inngest } from "./client.js";
import { askQuestionFn } from "./functions/askQuestion.js";
import { helloWorld } from "./functions/helloWorld.js";
import { indexRepo } from "./functions/indexRepo.js";

export { inngest };

export const functions = [helloWorld,indexRepo,askQuestionFn];