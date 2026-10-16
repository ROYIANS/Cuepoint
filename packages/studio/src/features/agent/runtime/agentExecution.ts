import {db} from "../../../platform/product/store";
import {createAgentExecutionService} from "./agentExecutionService";

// Module lifetime is the application/document lifetime, independent of React and routes.
export const agentExecution = createAgentExecutionService({store: db});
export function initializeAgentExecution(): Promise<void> {return agentExecution.initialize();}
