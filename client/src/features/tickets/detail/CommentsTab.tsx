import { useState } from 'react';
import toast from 'react-hot-toast';
import { Send, Trash2 } from 'lucide-react';
import { Button, Card, Spinner, Textarea } from '@/components/ui';
import { useAddComment, useDeleteComment, useTicketComments } from '@/lib/api/ticket';
import { useAuthStore } from '@/stores/authStore';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function CommentsTab({ ticketId }: { ticketId: string }) {
  const { data, isLoading, error } = useTicketComments(ticketId);
  const add = useAddComment(ticketId);
  const remove = useDeleteComment(ticketId);
  const [body, setBody] = useState('');
  const currentUserId = useAuthStore((s) => s.user?.id);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    try {
      await add.mutateAsync({ body: body.trim() });
      setBody('');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to post comment';
      toast.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Comment deleted');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to delete';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="!p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            maxLength={5000}
            className="flex-1"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={add.isPending}
            disabled={!body.trim() || add.isPending}
          >
            <Send size={14} />
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : error ? (
        <Card>
          <p className="text-sm text-red-600">Failed to load comments.</p>
        </Card>
      ) : (data?.items ?? []).length === 0 ? (
        <Card>
          <p className="text-xs text-gray-500 text-center py-4">No comments yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {(data?.items ?? []).map((c) => (
            <Card key={c.id} className="!p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {c.author?.name ?? 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.body}</p>
                </div>
                {c.author?.id === currentUserId && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                    aria-label="delete comment"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
