import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, File as FileIcon, LoaderCircle, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ApiErrorAlert as ErrorMessage, getApiErrorMessage } from '@/components/ApiErrorAlert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SectionHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/PageStates';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteAttachment, downloadAttachment, listAttachments, uploadAttachment } from '@/features/attachments/api';
import type { Attachment, AttachmentResourceType, UploadProgress } from '@/features/attachments/types';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

interface UploadState {
    fileName: string;
    percentage: number;
    error: string | null;
}

interface AttachmentPanelProps {
    resourceType: AttachmentResourceType;
    resourceKey: string | number;
    title?: string;
    canUpload?: boolean;
    canDelete?: boolean;
    disabled?: boolean;
    acceptedTypes?: string;
    maxFileSizeBytes?: number;
}

const defaultAcceptedTypes = 'image/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.csv';

function formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadId(file: File, index: number): string {
    return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

function InlineError({ message }: { message: string | null }) {
    if (!message) return null;

    return (
        <Alert className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40" role="alert">
            <AlertCircle className="text-rose-600 dark:text-rose-400" aria-hidden="true" />
            <AlertDescription className="text-rose-800 dark:text-rose-200">{message}</AlertDescription>
        </Alert>
    );
}

function AttachmentListSkeleton() {
    return (
        <div className="grid gap-3 lg:grid-cols-2" role="status" aria-label="Loading attachments">
            <span className="sr-only">Loading attachments...</span>
            {Array.from({ length: 2 }, (_, index) => (
                <div className="flex gap-4 rounded-lg border border-border p-4" key={index}>
                    <Skeleton className="size-12 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function AttachmentPanel({
    resourceType,
    resourceKey,
    title = 'Attachments',
    canUpload = true,
    canDelete = true,
    disabled = false,
    acceptedTypes = defaultAcceptedTypes,
    maxFileSizeBytes,
}: AttachmentPanelProps) {
    const queryClient = useQueryClient();
    const inputRef = useRef<HTMLInputElement>(null);
    const generatedId = useId();
    const inputId = `attachment-input-${generatedId}`;
    const inputHelpId = `${inputId}-help`;
    const titleId = `${inputId}-title`;
    const [isDragging, setIsDragging] = useState(false);
    const [uploads, setUploads] = useState<Record<string, UploadState>>({});
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
    const attachmentsQuery = useQuery({
        queryKey: ['attachments', resourceType, resourceKey],
        queryFn: () => listAttachments(resourceType, resourceKey),
        enabled: resourceKey !== '',
    });
    const deleteMutation = useMutation({
        mutationFn: deleteAttachment,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['attachments', resourceType, resourceKey] });
            setDeleteTarget(null);
        },
    });

    const setUploadState = (id: string, state: Partial<UploadState>) => {
        setUploads((current) => ({
            ...current,
            [id]: {
                ...(current[id] ?? { fileName: '', percentage: 0, error: null }),
                ...state,
            },
        }));
    };

    const handleFiles = async (fileList: FileList | File[]) => {
        if (!canUpload || disabled) return;

        const files = Array.from(fileList);
        if (files.length === 0) return;

        setUploadError(null);
        await Promise.all(
            files.map(async (file, index) => {
                const id = uploadId(file, index);
                if (maxFileSizeBytes !== undefined && file.size > maxFileSizeBytes) {
                    setUploadState(id, {
                        fileName: file.name,
                        percentage: 0,
                        error: `${file.name} exceeds the ${formatFileSize(maxFileSizeBytes)} limit.`,
                    });

                    return;
                }

                setUploadState(id, { fileName: file.name, percentage: 0, error: null });
                try {
                    await uploadAttachment(resourceType, resourceKey, file, (progress: UploadProgress) => {
                        setUploadState(id, { percentage: progress.percentage });
                    });
                    setUploadState(id, { percentage: 100 });
                } catch (error) {
                    const message = getApiErrorMessage(error, `Unable to upload ${file.name}.`) ?? `Unable to upload ${file.name}.`;
                    setUploadState(id, { error: message });
                    setUploadError(message);
                }
            }),
        );

        void queryClient.invalidateQueries({ queryKey: ['attachments', resourceType, resourceKey] });
    };

    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) void handleFiles(event.target.files);
        event.target.value = '';
    };

    const onDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (canUpload && !disabled) setIsDragging(true);
    };

    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        void handleFiles(event.dataTransfer.files);
    };

    const handleDownload = async (attachment: Attachment) => {
        setDownloadError(null);
        setDownloadingId(attachment.id);
        try {
            const blob = await downloadAttachment(attachment);
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = attachment.original_filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            setDownloadError(getApiErrorMessage(error, 'Unable to download this file.') ?? 'Unable to download this file.');
        } finally {
            setDownloadingId(null);
        }
    };

    const uploadEntries = Object.entries(uploads);
    const attachmentCount = attachmentsQuery.data?.length ?? 0;

    return (
        <Card role="region" aria-labelledby={titleId}>
            <CardHeader className="border-b border-border">
                <SectionHeader
                    title={<span id={titleId}>{title}</span>}
                    description="Upload photos, documents, or proof files. Downloads are checked against your access before the file is returned."
                    actions={
                        <Badge variant="outline">
                            {attachmentCount} file{attachmentCount === 1 ? '' : 's'}
                        </Badge>
                    }
                />
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-6">
                {canUpload && !disabled && (
                    <div
                        className={cn(
                            'rounded-xl border-2 border-dashed p-5 text-center transition-colors sm:p-7',
                            isDragging ? 'border-primary bg-accent' : 'border-input bg-muted/35 hover:border-primary/50',
                        )}
                        role="group"
                        aria-label="File upload area"
                        onDragOver={onDragOver}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={onDrop}
                    >
                        <label className="sr-only" htmlFor={inputId}>
                            Upload attachments
                        </label>
                        <input
                            ref={inputRef}
                            className="sr-only"
                            id={inputId}
                            type="file"
                            multiple
                            accept={acceptedTypes}
                            aria-describedby={inputHelpId}
                            onChange={onFileChange}
                        />
                        <span
                            className="mx-auto grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground"
                            aria-hidden="true"
                        >
                            <UploadCloud size={22} />
                        </span>
                        <p className="mt-4 text-sm font-semibold text-foreground">Drag and drop files here</p>
                        <p id={inputHelpId} className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                            or choose files from your device. Executable files are not accepted.
                            {maxFileSizeBytes !== undefined ? ` Maximum file size: ${formatFileSize(maxFileSizeBytes)}.` : ''}
                        </p>
                        <Button
                            className="mt-4 w-full sm:w-auto"
                            type="button"
                            variant="outline"
                            aria-controls={inputId}
                            onClick={() => inputRef.current?.click()}
                        >
                            <Paperclip aria-hidden="true" />
                            Choose files
                        </Button>
                    </div>
                )}

                {disabled && (
                    <Alert>
                        <AlertDescription>Attachments cannot be changed while this record is locked.</AlertDescription>
                    </Alert>
                )}
                {!canUpload && (
                    <Alert>
                        <AlertDescription>You can view and download attachments, but do not have permission to add files.</AlertDescription>
                    </Alert>
                )}

                <InlineError message={uploadError} />
                <InlineError message={downloadError} />
                <ErrorMessage error={deleteMutation.error} fallback="Unable to delete this file." />

                {uploadEntries.length > 0 && (
                    <section className="space-y-3" aria-label="Upload progress" aria-live="polite">
                        {uploadEntries.map(([id, upload]) => (
                            <div key={id} className="rounded-lg border border-border bg-muted/25 p-3">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="truncate font-medium text-foreground">{upload.fileName}</span>
                                    <span className={cn('shrink-0 text-xs', upload.error ? 'text-destructive' : 'text-muted-foreground')}>
                                        {upload.error ?? `${upload.percentage}%`}
                                    </span>
                                </div>
                                {!upload.error && (
                                    <div
                                        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                                        role="progressbar"
                                        aria-label={`Uploading ${upload.fileName}`}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={upload.percentage}
                                        aria-valuetext={upload.percentage === 100 ? 'Upload complete' : `${upload.percentage}% uploaded`}
                                    >
                                        <div
                                            className="h-full rounded-full bg-primary transition-[width]"
                                            style={{ width: `${upload.percentage}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </section>
                )}

                <div>
                    {attachmentsQuery.isLoading && <AttachmentListSkeleton />}
                    <ErrorMessage error={attachmentsQuery.error} fallback="Unable to load attachments." />
                    {!attachmentsQuery.isLoading && !attachmentsQuery.error && attachmentCount === 0 && (
                        <EmptyState
                            compact
                            icon={Paperclip}
                            title="No files have been attached yet."
                            description="Uploaded photos and documents will appear here."
                        />
                    )}
                    <ul className="grid gap-3 lg:grid-cols-2" aria-label={`${title} list`}>
                        {attachmentsQuery.data?.map((attachment) => (
                            <li className="overflow-hidden rounded-lg border border-border bg-card" key={attachment.uuid}>
                                {attachment.is_previewable_image && attachment.preview_url ? (
                                    <img
                                        className="h-40 w-full bg-muted object-cover"
                                        src={attachment.preview_url}
                                        alt={`Preview of ${attachment.original_filename}`}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="grid h-24 place-items-center bg-muted/55 text-muted-foreground" aria-hidden="true">
                                        <FileIcon size={27} />
                                    </div>
                                )}
                                <div className="p-4">
                                    <p className="truncate text-sm font-semibold text-foreground" title={attachment.original_filename}>
                                        {attachment.original_filename}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {formatFileSize(attachment.size)} / {attachment.mime_type}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        Added {formatDate(attachment.created_at)}
                                        {attachment.uploaded_by ? ` by ${attachment.uploaded_by.display_name}` : ''}
                                    </p>
                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                        <Button
                                            className="w-full sm:w-auto"
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={downloadingId === attachment.id}
                                            aria-busy={downloadingId === attachment.id}
                                            onClick={() => void handleDownload(attachment)}
                                        >
                                            {downloadingId === attachment.id ? (
                                                <LoaderCircle className="animate-spin" aria-hidden="true" />
                                            ) : (
                                                <Download aria-hidden="true" />
                                            )}
                                            {downloadingId === attachment.id ? 'Preparing...' : 'Download'}
                                        </Button>
                                        {canDelete && !disabled && (
                                            <Button
                                                className="w-full sm:w-auto"
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setDeleteTarget(attachment)}
                                            >
                                                <Trash2 aria-hidden="true" />
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete attachment"
                description={`Delete ${deleteTarget?.original_filename ?? 'this attachment'}? This cannot be undone.`}
                confirmLabel="Delete file"
                isPending={deleteMutation.isPending}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            />
        </Card>
    );
}
