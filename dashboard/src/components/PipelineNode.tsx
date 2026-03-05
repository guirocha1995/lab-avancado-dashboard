import React from 'react';
import {
  Server,
  MessageSquare,
  Code,
  Zap,
  Radio,
  AlertTriangle,
  BarChart3,
  Package,
  Shield,
  Workflow,
  Cog,
  CheckCircle,
  CreditCard,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';

export type NodeState = 'idle' | 'active' | 'success' | 'error';

interface PipelineNodeProps {
  icon?: string;
  label: string;
  count: number;
  state: NodeState;
  showConnector?: boolean;
  connectorActive?: boolean;
}

const iconMap: Record<string, LucideIcon> = {
  server: Server,
  'message-square': MessageSquare,
  code: Code,
  zap: Zap,
  radio: Radio,
  'alert-triangle': AlertTriangle,
  'bar-chart': BarChart3,
  package: Package,
  shield: Shield,
  workflow: Workflow,
  cog: Cog,
  'check-circle': CheckCircle,
  'credit-card': CreditCard,
  'clipboard-check': ClipboardCheck,
};

const stateStyles: Record<NodeState, { ring: string; bg: string; nodeClass: string }> = {
  idle: {
    ring: 'ring-gray-200',
    bg: 'bg-gray-100',
    nodeClass: '',
  },
  active: {
    ring: 'ring-azure-300',
    bg: 'bg-azure-50',
    nodeClass: 'node-active',
  },
  success: {
    ring: 'ring-green-300',
    bg: 'bg-green-50',
    nodeClass: 'node-success',
  },
  error: {
    ring: 'ring-red-300',
    bg: 'bg-red-50',
    nodeClass: 'node-error',
  },
};

const stateIconColors: Record<NodeState, string> = {
  idle: 'text-gray-400',
  active: 'text-azure-500',
  success: 'text-green-500',
  error: 'text-red-500',
};

export const PipelineNode: React.FC<PipelineNodeProps> = ({
  icon = 'server',
  label,
  count,
  state,
  showConnector = false,
  connectorActive = false,
}) => {
  const IconComponent = iconMap[icon] ?? Server;
  const styles = stateStyles[state];
  const iconColor = stateIconColors[state];

  return (
    <div className="flex items-center">
      {/* Node */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <div
            className={`w-14 h-14 rounded-full ${styles.bg} ring-2 ${styles.ring} ${styles.nodeClass} flex items-center justify-center transition-all duration-300`}
          >
            <IconComponent size={22} className={iconColor} />
          </div>
          {/* Count badge */}
          {count > 0 && (
            <span className="absolute -top-1 -right-1 bg-azure-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-gray-600 text-center max-w-[80px] leading-tight">
          {label}
        </span>
      </div>

      {/* Connector line to next node */}
      {showConnector && (
        <div className="relative w-12 h-0.5 bg-gray-200 mx-1 mt-[-20px]">
          {connectorActive && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="flow-dot absolute top-[-2px] w-1.5 h-1.5 rounded-full bg-azure-500" />
              <div className="flow-dot absolute top-[-2px] w-1.5 h-1.5 rounded-full bg-azure-500" />
              <div className="flow-dot absolute top-[-2px] w-1.5 h-1.5 rounded-full bg-azure-500" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PipelineNode;
