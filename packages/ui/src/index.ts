// Provider and API
export { GoatProvider, useGoat, useGoatOptional } from "./provider.js";
export { CrossmintScope } from "./components/crossmint-scope.js";
export type { GoatProviderProps, GoatContextValue } from "./provider.js";
export { createGoatApi, GoatApiError, errorMessage } from "./api/client.js";
export type { GoatApi, GoatApiOptions, GetJwt } from "./api/client.js";
export type * from "./api/types.js";

// Hooks
export * from "./hooks/index.js";

// Components
export { SaveCard } from "./components/save-card.js";
export type { SaveCardProps, SaveCardResult, PaymentMethodAppearance } from "./components/save-card.js";
export { CardPicker, ADD_NEW_CARD } from "./components/card-picker.js";
export type { CardPickerProps } from "./components/card-picker.js";
export { AddCardDialog } from "./components/add-card-dialog.js";
export type { AddCardDialogProps } from "./components/add-card-dialog.js";
export { ApproveAgentCard } from "./components/approve-agent-card.js";
export type { ApproveAgentCardProps, ApproveOutcome, ApproveOutcomeStatus } from "./components/approve-agent-card.js";
export { ApproveAgentCardPreview } from "./components/approve-agent-card-preview.js";
export type { ApproveAgentCardPreviewProps } from "./components/approve-agent-card-preview.js";
export { VerifyAgentCard } from "./components/verify-agent-card.js";
export type { VerifyAgentCardProps, VerificationAppearance } from "./components/verify-agent-card.js";
export { AgentCardList, RailBadge, agentCardStatusBadge } from "./components/agent-card-list.js";
export type { AgentCardListProps } from "./components/agent-card-list.js";
export { PendingActionForm } from "./components/pending-action-form.js";
export type { PendingActionFormProps } from "./components/pending-action-form.js";
export { CheckoutView } from "./components/checkout-view.js";
export type { CheckoutViewProps } from "./components/checkout-view.js";
export { ConnectedAgents } from "./components/connected-agents.js";
export type { ConnectedAgentsProps, ConnectedAgentSession } from "./components/connected-agents.js";
export { Mascot, EmptyState } from "./components/mascot.js";
export type { MascotProps, EmptyStateProps } from "./components/mascot.js";

// Primitives
export * from "./components/primitives/index.js";

// Utilities
export { cn } from "./lib/utils.js";
export * from "./lib/format.js";
export * from "./lib/appearance.js";
