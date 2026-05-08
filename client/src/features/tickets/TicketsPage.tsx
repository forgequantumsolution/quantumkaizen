import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Ticket as TicketIcon,
  Clock,
  Network,
  User as UserIcon,
} from 'lucide-react';
import { Card, Button, EmptyState, Spinner, Input, Select } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useTickets, type ListTicketsQuery } from '@/lib/api/ticket';
import RaiseTicketModal from './shared/RaiseTicketModal';
import TicketStatusBadge from './shared/TicketStatusBadge';

const STATUS_OPTIONS: { value: NonNullable<ListTicketsQuery['status']> | ''; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
];

export default function TicketsPage() {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('ticket.create');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListTicketsQuery['status']>('all');
  const [mine, setMine] = useState<'true' | 'false'>('false');
  const [createOpen, setCreateOpen] = useState(false);

  const filters: ListTicketsQuery = useMemo(
    () => ({
      search: search || undefined,
      status,
      mine,
      pageSize: 50,
    }),
    [search, status, mine],
  );

  const { data, isLoading, error } = useTickets(filters);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Tickets"
        description={
          total > 0
            ? `${total} ticket${total === 1 ? '' : 's'} in scope`
            : 'Raise and track tickets against active workflows'
        }
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              <span className="ml-1.5">Raise Ticket</span>
            </Button>
          ) : null
        }
      />

      <Card className="mt-6 !p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            />
            <Input
              placeholder="Search by ID or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as ListTicketsQuery['status'])}
            options={STATUS_OPTIONS}
          />
          <Select
            value={mine}
            onChange={(e) => setMine(e.target.value as 'true' | 'false')}
            options={[
              { value: 'false', label: 'All tickets' },
              { value: 'true', label: 'Mine only' },
            ]}
          />
        </div>
      </Card>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <Card>
            <p className="text-sm text-red-600">Failed to load tickets.</p>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon={TicketIcon}
              title="No tickets yet"
              description={
                search || status !== 'all' || mine === 'true'
                  ? 'No tickets match the current filters.'
                  : canCreate
                    ? 'Raise your first ticket to get started.'
                    : "You don't have any tickets yet."
              }
              actionLabel={canCreate ? 'Raise Ticket' : undefined}
              onAction={canCreate ? () => setCreateOpen(true) : undefined}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((t) => (
              <Card
                key={t.id}
                className={cn(
                  'hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-3 !p-5',
                )}
                onClick={() => navigate(`/tickets/${t.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {t.uniqueId}
                      </span>
                      {t.priority && (
                        <span className="text-[10px] text-gray-500">{t.priority.name}</span>
                      )}
                    </div>
                    <h3 className="text-body-md font-semibold text-gray-900 truncate">
                      {t.title}
                    </h3>
                  </div>
                  <TicketStatusBadge ticket={t} />
                </div>

                {t.flows[0] && (
                  <div className="text-xs text-gray-500 truncate">
                    <Network size={12} className="inline mr-1" />
                    {t.flows[0].workflowName}
                    {t.flows[0].currentStages.length > 0 && (
                      <>
                        {' · '}
                        <span className="text-gray-700">
                          {t.flows[0].currentStages.map((s) => s.name).join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(t.updatedAt)}
                  </span>
                  {t.createdBy && (
                    <span className="flex items-center gap-1 truncate">
                      <UserIcon size={12} />
                      {t.createdBy.name}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RaiseTicketModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </PageContainer>
  );
}
