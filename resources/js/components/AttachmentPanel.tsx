import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { deleteAttachment, downloadAttachment, listAttachments, uploadAttachment } from '@/features/attachments/api';
import type { Attachment, AttachmentResourceType, UploadProgress } from '@/features/attachments/types';
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

function errorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? error.message ?? fallback;
    if (error instanceof Error) return error.message;

    return fallback;
}

function formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadId(file: File, index: number): string {
    return `${file.name}-${file.size}-${file.lastModified}-${index}`;
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
        await Promise.all(files.map(async (file, index) => {
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
                const message = errorMessage(error, `Unable to upload ${file.name}.`);
                setUploadState(id, { error: message });
                setUploadError(message);
            }
        }));

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
            setDownloadError(errorMessage(error, 'Unable to download this file.'));
        } finally {
            setDownloadingId(null);
        }
    };

    const uploadEntries = Object.entries(uploads);

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm text-slate-600">Upload photos, documents, or proof files. Downloads are checked against your access before the file is returned.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{attachmentsQuery.data?.length ?? 0} file{(attachmentsQuery.data?.length ?? 0) === 1 ? '' : 's'}</span>
            </div>

            {canUpload && !disabled && (
                <div
                    className={`mt-5 rounded-xl border-2 border-dashed p-6 text-center transition ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
                    onDragOver={onDragOver}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                >
                    <input ref={inputRef} className="sr-only" id={`${resourceType}-${resourceKey}-attachment-input`} type="file" multiple accept={acceptedTypes} onChange={onFileChange} />
                    <p className="text-sm font-semibold text-slate-800">Drag and drop files here</p>
                    <p className="mt-1 text-sm text-slate-600">or choose files from your device. Executable files are not accepted.</p>
                    <button className="mt-4 rounded-md border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50" type="button" onClick={() => inputRef.current?.click()}>Choose files</button>
                </div>
            )}

            {disabled && <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">Attachments cannot be changed while this record is locked.</p>}
            {!canUpload && <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">You can view and download attachments, but do not have permission to add files.</p>}
            {uploadError && <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{uploadError}</p>}
            {downloadError && <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{downloadError}</p>}
            {deleteMutation.error && <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{errorMessage(deleteMutation.error, 'Unable to delete this file.')}</p>}

            {uploadEntries.length > 0 && (
                <div className="mt-4 space-y-3" aria-live="polite">
                    {uploadEntries.map(([id, upload]) => (
                        <div key={id} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium text-slate-800">{upload.fileName}</span><span className={upload.error ? 'text-rose-700' : 'text-slate-500'}>{upload.error ?? `${upload.percentage}%`}</span></div>
                            {!upload.error && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Uploading ${upload.fileName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.percentage}><div className="h-full bg-blue-600 transition-all" style={{ width: `${upload.percentage}%` }} /></div>}
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-5">
                {attachmentsQuery.isLoading && <p className="text-sm text-slate-600">Loading attachments...</p>}
                {attachmentsQuery.error && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{errorMessage(attachmentsQuery.error, 'Unable to load attachments.')}</p>}
                {!attachmentsQuery.isLoading && !attachmentsQuery.error && (attachmentsQuery.data?.length ?? 0) === 0 && <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No files have been attached yet.</p>}
                <ul className="grid gap-3 sm:grid-cols-2" aria-label={`${title} list`}>
                    {attachmentsQuery.data?.map((attachment) => (
                        <li className="overflow-hidden rounded-lg border border-slate-200" key={attachment.uuid}>
                            {attachment.is_previewable_image && attachment.preview_url && <img className="h-40 w-full bg-slate-100 object-cover" src={attachment.preview_url} alt={`Preview of ${attachment.original_filename}`} loading="lazy" />}
                            <div className="p-4">
                                <p className="truncate text-sm font-semibold text-slate-900" title={attachment.original_filename}>{attachment.original_filename}</p>
                                <p className="mt-1 text-xs text-slate-500">{formatFileSize(attachment.size)} / {attachment.mime_type}</p>
                                <p className="mt-1 text-xs text-slate-500">Added {formatDate(attachment.created_at)}{attachment.uploaded_by ? ` by ${attachment.uploaded_by.display_name}` : ''}</p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button className="text-sm font-semibold text-blue-700 disabled:opacity-50" type="button" disabled={downloadingId === attachment.id} onClick={() => void handleDownload(attachment)}>{downloadingId === attachment.id ? 'Preparing...' : 'Download'}</button>
                                    {canDelete && !disabled && <button className="text-sm font-semibold text-rose-700" type="button" onClick={() => setDeleteTarget(attachment)}>Delete</button>}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete attachment"
                description={`Delete ${deleteTarget?.original_filename ?? 'this attachment'}? This cannot be undone.`}
                confirmLabel="Delete file"
                isPending={deleteMutation.isPending}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            />
        </section>
    );
}

