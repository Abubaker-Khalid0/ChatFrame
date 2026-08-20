import {
  Plug,
  MessagesSquare,
  ShieldCheck,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import type { Dictionary } from '../i18n';
import { STAGE_ORDER, type WorkflowStage } from '../stores/useWorkflowStore';

export type RailNodeId = 'connect' | 'chat-picker' | 'quality' | 'preview';

export interface RailNode {
  id: RailNodeId;
  icon: LucideIcon;
  /** The stage entered when this node is activated (its primary stage). */
  entryStage: WorkflowStage;
  /** All stages that map to this node (drives active/done computation). */
  stages: readonly WorkflowStage[];
  labelKey: keyof Dictionary['wizard']['steps'];
}

/** The five pipeline nodes shown in the rail, in forward order. */
export const RAIL_NODES: readonly RailNode[] = [
  { id: 'connect', icon: Plug, entryStage: 'connect', stages: ['connect'], labelKey: 'connect' },
  {
    id: 'chat-picker',
    icon: MessagesSquare,
    entryStage: 'chat-picker',
    stages: ['chat-picker', 'import-config', 'import-progress'],
    labelKey: 'chatPicker',
  },
  {
    id: 'quality',
    icon: ShieldCheck,
    entryStage: 'quality',
    stages: ['quality'],
    labelKey: 'quality',
  },
  { id: 'preview', icon: Eye, entryStage: 'preview', stages: ['preview', 'export', 'export-complete'], labelKey: 'preview' },
];

export type RailNodeStatus = 'done' | 'active' | 'upcoming';

/** Index of the rail node that owns a given stage. */
export function nodeIndexForStage(stage: WorkflowStage): number {
  return RAIL_NODES.findIndex((node) => node.stages.includes(stage));
}

/** done if before the active node, active if it owns the current stage, else upcoming. */
export function statusForNode(nodeIndex: number, currentStage: WorkflowStage): RailNodeStatus {
  const activeIndex = nodeIndexForStage(currentStage);
  if (nodeIndex === activeIndex) {
    return 'active';
  }
  return nodeIndex < activeIndex ? 'done' : 'upcoming';
}

/** Forward-order rank of a stage (for comparisons). */
export function stageRank(stage: WorkflowStage): number {
  return STAGE_ORDER.indexOf(stage);
}
