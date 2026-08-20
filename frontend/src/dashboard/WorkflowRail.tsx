import { useState } from 'react';
import { Check, HardDrive, EyeOff, PanelLeftClose } from 'lucide-react';
import { useTranslations } from '../i18n';
import { canEnter, useWorkflowStore } from '../stores/useWorkflowStore';
import { cn } from '../components/ui/cn';
import { RAIL_NODES, statusForNode } from './rail';
import logoSrc from '../assets/logo.png';

/** Step sublabel keys matching the rail node ids. */
const STEP_SUBLABEL_KEYS: Record<string, 'connect' | 'selectChat' | 'import' | 'quality' | 'preview' | 'export'> = {
  connect: 'connect',
  'chat-picker': 'selectChat',
  quality: 'quality',
  preview: 'preview',
};

/**
 * Vertical workflow rail with collapse/expand toggle and step icons.
 * - Expanded: icons + labels + sublabels + privacy info
 * - Collapsed: icons only in a narrow strip
 */
export function WorkflowRail() {
  const t = useTranslations();
  const stage = useWorkflowStore((s) => s.stage);
  const goToStage = useWorkflowStore((s) => s.goToStage);
  const data = useWorkflowStore((s) => s);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-e border-line bg-surface transition-[width] duration-200 overflow-hidden',
        collapsed ? 'w-[52px]' : 'w-[52px] md:w-[268px]',
      )}
    >
      {/* Brand header */}
      <div className={cn(
        'flex h-16 items-center border-b border-line px-3',
        collapsed ? 'justify-center' : 'justify-between',
      )}>
        <div className={cn('flex items-center gap-2.5', collapsed && 'hidden')}>
          <img src={logoSrc} alt="ChatFrame" className="h-9 w-9 shrink-0 rounded-[10px] object-contain" />
          {!collapsed && (
            <span className="hidden text-base font-bold text-ink md:inline">{t.appName}</span>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex h-8 w-8 items-center justify-center"
            aria-label="Expand sidebar"
          >
            <img src={logoSrc} alt="ChatFrame" className="h-8 w-8 shrink-0 rounded-[8px] object-contain" />
          </button>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="hidden h-7 w-7 items-center justify-center rounded-[8px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink md:flex"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Stepper navigation */}
      <nav aria-label={t.dashboard.navLabel} className={cn('flex-1 overflow-y-auto py-5', collapsed ? 'px-1.5' : 'px-2 md:px-3')}>
        <ol className="relative flex flex-col gap-1">
          {/* Single continuous vertical line behind all steps */}
          {!collapsed && (
            <div
              className="absolute inset-inline-start-[27px] top-[44px] hidden h-[calc(100%-80px)] w-[2px] rounded-full bg-line md:block"
              style={{ insetInlineStart: '27px' }}
              aria-hidden="true"
            />
          )}
          {RAIL_NODES.map((node, index) => {
            const status = statusForNode(index, stage);
            const reachable = canEnter(node.entryStage, data);
            const label = t.wizard.steps[node.labelKey];
            const sublabelKey = STEP_SUBLABEL_KEYS[node.id];
            const sublabel = sublabelKey ? t.session.steps[sublabelKey] : '';
            const Icon = node.icon;

            return (
              <li key={node.id} className="relative">
                <button
                  type="button"
                  disabled={!reachable}
                  aria-current={status === 'active' ? 'step' : undefined}
                  title={label}
                  onClick={() => goToStage(node.entryStage)}
                  className={cn(
                    'relative flex w-full items-center rounded-[12px] text-start transition-all duration-150',
                    collapsed ? 'justify-center px-1 py-2' : 'gap-3 px-2 py-2.5 md:px-3 md:py-3',
                    status === 'active' && 'bg-accent-soft shadow-[0_0_0_1px_var(--color-accent-border)]',
                    reachable && status !== 'active' && 'hover:bg-surface-hover',
                    !reachable && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {/* Icon circle */}
                  <span
                    className={cn(
                      'relative z-10 flex shrink-0 items-center justify-center rounded-full transition-colors',
                      collapsed ? 'h-7 w-7' : 'h-8 w-8',
                      status === 'active'
                        ? 'bg-accent text-white shadow-[0_2px_8px_rgba(5,150,105,0.3)]'
                        : status === 'done'
                          ? 'bg-accent-soft text-accent'
                          : 'bg-surface-muted text-ink-muted',
                    )}
                  >
                    {status === 'done' ? (
                      <Check size={collapsed ? 13 : 15} strokeWidth={2.5} />
                    ) : (
                      <Icon size={collapsed ? 13 : 15} />
                    )}
                  </span>

                  {/* Label and sublabel — hidden when collapsed */}
                  {!collapsed && (
                    <div className="hidden min-w-0 flex-1 md:block">
                      <p
                        className={cn(
                          'text-[13px] font-semibold leading-tight',
                          status === 'active'
                            ? 'text-accent-ink'
                            : status === 'done'
                              ? 'text-ink'
                              : 'text-ink-secondary',
                        )}
                      >
                        {label}
                      </p>
                      {sublabel && (
                        <p className="mt-0.5 truncate text-[11px] text-ink-muted">{sublabel}</p>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Bottom privacy info — hidden when collapsed */}
      {!collapsed && (
        <div className="hidden border-t border-line px-3 py-4 md:block">
          <div className="rounded-[12px] border border-line bg-surface-muted px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                <HardDrive size={14} className="text-accent" />
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">{t.session.sidebar.localOnly}</p>
                <p className="text-[10px] text-ink-muted">{t.session.sidebar.localOnlyDesc}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                <EyeOff size={14} className="text-accent" />
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">{t.session.sidebar.readOnly}</p>
                <p className="text-[10px] text-ink-muted">{t.session.sidebar.readOnlyDesc}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
