import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import JSZip from 'jszip';
import {
  Archive,
  ArrowDownToLine,
  Check,
  ChevronRight,
  Copy,
  File,
  FileImage,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Heart,
  Image as ImageIcon,
  List,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { TabLayout } from '@/components/TabLayout';

const DATABASE_KEY = 'minecraft-texture-editor-file-manager-v1';
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']);
const TEXT_TYPES = new Set([
  'application/json',
  'text/plain',
  'text/markdown',
  'text/css',
  'text/xml',
  'application/xml',
]);
const PACK_FOLDERS = [
  'block',
  'item',
  'entity',
  'gui',
  'particle',
  'effect',
  'environment',
  'font',
  'colormap',
  'misc',
  'painting',
  'models',
];

type FileVersion = {
  savedAt: number;
  data: Uint8Array;
  size: number;
};

type WorkspaceEntry = {
  id: string;
  name: string;
  parentId: string | null;
  kind: 'file' | 'folder';
  mimeType: string;
  size: number;
  modifiedAt: number;
  data?: Uint8Array;
  favorite: boolean;
  tags: string[];
  deletedAt: number | null;
  history: FileVersion[];
};

type FilterMode = 'all' | 'images' | 'documents' | 'favorites' | 'duplicates' | 'trash';

type ImageMetadata = {
  entryId: string;
  width: number;
  height: number;
  exif: string[];
  xmp: string | null;
  pngText: string[];
};

type ContextMenuState = {
  entryId: string;
  x: number;
  y: number;
};

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeRelativePath = (value: string) => {
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized) || parts.includes('..')) return '';
  return parts.filter((part) => part && part !== '.').join('/');
};

const validateEntryName = (value: string) => {
  const name = value.trim();
  return name && name !== '.' && name !== '..' && !/[<>:"/\\|?*\u0000-\u001f]|\.$/.test(name)
    ? name
    : null;
};

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

const mimeFromName = (name: string) => {
  const extension = extensionOf(name);
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    json: 'application/json',
    txt: 'text/plain',
    md: 'text/markdown',
    mcmeta: 'application/json',
    xml: 'application/xml',
    css: 'text/css',
  };
  return mimeTypes[extension] ?? 'application/octet-stream';
};

const makeEntry = (
  name: string,
  parentId: string | null,
  kind: 'file' | 'folder',
  data?: Uint8Array,
  mimeType?: string
): WorkspaceEntry => ({
  id: createId(),
  name,
  parentId,
  kind,
  mimeType: kind === 'folder' ? 'inode/directory' : mimeType ?? mimeFromName(name),
  size: data?.byteLength ?? 0,
  modifiedAt: Date.now(),
  data,
  favorite: false,
  tags: [],
  deletedAt: null,
  history: [],
});

const createInitialEntries = () => {
  const entries: WorkspaceEntry[] = [];
  const addFolder = (name: string, parentId: string | null) => {
    const entry = makeEntry(name, parentId, 'folder');
    entries.push(entry);
    return entry.id;
  };

  const assetsId = addFolder('assets', null);
  const minecraftId = addFolder('minecraft', assetsId);
  const texturesId = addFolder('textures', minecraftId);
  PACK_FOLDERS.forEach((folder) => addFolder(folder, texturesId));
  entries.push(
    makeEntry(
      'pack.mcmeta',
      null,
      'file',
      new TextEncoder().encode(
        JSON.stringify({ pack: { pack_format: 34, description: 'My Resource Pack' } }, null, 2)
      ),
      'application/json'
    ),
    makeEntry('README.txt', null, 'file', new TextEncoder().encode('Minecraft resource pack\n')),
    makeEntry('LICENSE', null, 'file', new TextEncoder().encode('')),
    makeEntry('CHANGELOG.txt', null, 'file', new TextEncoder().encode(''))
  );
  return entries;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const isImage = (entry: WorkspaceEntry) =>
  entry.kind === 'file' && (IMAGE_TYPES.has(entry.mimeType) || /\.(png|jpe?g|gif|webp|avif)$/i.test(entry.name));

const isDocument = (entry: WorkspaceEntry) =>
  entry.kind === 'file' && (TEXT_TYPES.has(entry.mimeType) || /\.(json|mcmeta|txt|md|xml|css)$/i.test(entry.name));

const entryBlob = (entry: WorkspaceEntry) =>
  new Blob([entry.data ?? new Uint8Array()], { type: entry.mimeType || 'application/octet-stream' });

const decodeAscii = (bytes: Uint8Array, start: number, length: number) =>
  new TextDecoder('latin1').decode(bytes.subarray(start, start + length));

const parseTiffExif = (bytes: Uint8Array, start: number, length: number) => {
  const tags: string[] = [];
  if (length < 8 || start < 0 || start + length > bytes.length) return tags;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteOrder = decodeAscii(bytes, start, 2);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return tags;
  const littleEndian = byteOrder === 'II';
  const read16 = (offset: number) => view.getUint16(offset, littleEndian);
  const read32 = (offset: number) => view.getUint32(offset, littleEndian);
  if (read16(start + 2) !== 42) return tags;

  const ifdOffset = start + read32(start + 4);
  if (ifdOffset + 2 > start + length) return tags;
  const entryCount = Math.min(read16(ifdOffset), 256);
  const tagNames: Record<number, string> = {
    0x010f: 'Камера',
    0x0110: 'Модель',
    0x0112: 'Ориентация',
    0x0131: 'ПО',
    0x0132: 'Дата',
    0x9003: 'Дата снимка',
  };

  for (let index = 0; index < entryCount; index += 1) {
    const offset = ifdOffset + 2 + index * 12;
    if (offset + 12 > start + length) break;
    const tag = read16(offset);
    const type = read16(offset + 2);
    const count = read32(offset + 4);
    const name = tagNames[tag];
    if (!name || count === 0) continue;
    let value = '';

    if (type === 2) {
      const valueOffset = count <= 4 ? offset + 8 : start + read32(offset + 8);
      if (valueOffset >= start && valueOffset + Math.min(count, 512) <= start + length) {
        value = decodeAscii(bytes, valueOffset, Math.min(count, 512)).replace(/\0+$/, '').trim();
      }
    } else if (type === 3) {
      value = String(read16(offset + 8));
    } else if (type === 4) {
      value = String(read32(offset + 8));
    }
    if (value) tags.push(`${name}: ${value}`);
  }
  return tags;
};

const readImageMetadata = async (entry: WorkspaceEntry): Promise<ImageMetadata> => {
  const bytes = entry.data ?? new Uint8Array();
  const image = await createImageBitmap(entryBlob(entry));
  const metadata: ImageMetadata = {
    entryId: entry.id,
    width: image.width,
    height: image.height,
    exif: [],
    xmp: null,
    pngText: [],
  };
  image.close();

  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  if (isPng) {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const chunkLength = view.getUint32(offset);
      const chunkType = decodeAscii(bytes, offset + 4, 4);
      const dataStart = offset + 8;
      const dataEnd = dataStart + chunkLength;
      if (dataEnd + 4 > bytes.length) break;
      if (chunkType === 'eXIf') {
        metadata.exif.push(...parseTiffExif(bytes, dataStart, chunkLength));
      } else if (chunkType === 'tEXt') {
        const chunk = decodeAscii(bytes, dataStart, chunkLength);
        const separator = chunk.indexOf('\0');
        metadata.pngText.push(separator < 0 ? chunk : `${chunk.slice(0, separator)}: ${chunk.slice(separator + 1)}`);
      } else if (chunkType === 'iTXt') {
        const chunk = decodeAscii(bytes, dataStart, chunkLength);
        if (chunk.includes('<x:xmpmeta') || chunk.includes('<rdf:RDF')) metadata.xmp = chunk.slice(chunk.indexOf('<'), chunk.length);
        else {
          const separator = chunk.indexOf('\0');
          metadata.pngText.push(separator < 0 ? chunk : `${chunk.slice(0, separator)}: ${chunk.slice(separator + 1)}`);
        }
      }
      offset = dataEnd + 4;
      if (chunkType === 'IEND') break;
    }
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
      const marker = bytes[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      const dataStart = offset + 4;
      const dataLength = segmentLength - 2;
      if (dataLength <= 0 || dataStart + dataLength > bytes.length) break;
      if (marker === 0xe1) {
        const signature = decodeAscii(bytes, dataStart, Math.min(dataLength, 6));
        const xmpHeader = 'http://ns.adobe.com/xap/1.0/';
        if (signature.startsWith('Exif\u0000\u0000')) {
          metadata.exif.push(...parseTiffExif(bytes, dataStart + 6, dataLength - 6));
        } else if (decodeAscii(bytes, dataStart, Math.min(dataLength, xmpHeader.length)).startsWith(xmpHeader)) {
          const xmlStart = dataStart + xmpHeader.length + 1;
          metadata.xmp = decodeAscii(bytes, xmlStart, dataStart + dataLength - xmlStart);
        }
      }
      offset = dataStart + dataLength;
    }
  }
  return metadata;
};

const getEntryPath = (entry: WorkspaceEntry, entries: WorkspaceEntry[]) => {
  const names = [entry.name];
  let parentId = entry.parentId;
  while (parentId) {
    const parent = entries.find((item) => item.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join('/');
};

export const FileManagerTab: React.FC = () => {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [textDraft, setTextDraft] = useState<string | null>(null);
  const [watermark, setWatermark] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.65);
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showHistory, setShowHistory] = useState(false);
  const [clipboardId, setClipboardId] = useState<string | null>(null);
  const [clipboardAction, setClipboardAction] = useState<'copy' | 'move'>('copy');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    get<WorkspaceEntry[]>(DATABASE_KEY)
      .then((saved) => {
        if (!active) return;
        setEntries(saved?.length ? saved : createInitialEntries());
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(`Не удалось прочитать локальную базу файлов: ${String(reason)}`);
        setEntries(createInitialEntries());
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    set(DATABASE_KEY, entries).catch((reason: unknown) => {
      setError(`Не удалось сохранить рабочую область в IndexedDB: ${String(reason)}`);
    });
  }, [entries, ready]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selected = entries.find((entry) => entry.id === selectedId && !entry.deletedAt) ?? null;
  const activeFolder =
    activeFolderId === null
      ? null
      : entries.find((entry) => entry.id === activeFolderId && entry.kind === 'folder' && !entry.deletedAt) ?? null;
  const selectedEntryId = selected?.id;
  const selectedData = selected?.data;
  const selectedTags = selected?.tags;
  const selectedModifiedAt = selected?.modifiedAt;
  const selectedIsDocument = selected ? isDocument(selected) : false;
  const selectedImage = selected && isImage(selected) ? selected : null;

  useEffect(() => {
    if (!selectedEntryId || !selectedIsDocument) {
      setTextDraft(null);
      setTagDraft(selectedTags?.join(', ') ?? '');
      return;
    }
    setTextDraft(new TextDecoder().decode(selectedData ?? new Uint8Array()));
    setTagDraft(selectedTags?.join(', ') ?? '');
  }, [selectedData, selectedEntryId, selectedIsDocument, selectedModifiedAt, selectedTags]);

  useEffect(() => {
    if (!selectedImage) {
      setImageMetadata(null);
      setPreviewUrl(null);
      return;
    }
    let active = true;
    const objectUrl = URL.createObjectURL(entryBlob(selectedImage));
    setPreviewUrl(objectUrl);
    setImageMetadata(null);
    readImageMetadata(selectedImage)
      .then((metadata) => {
        if (active) setImageMetadata(metadata);
      })
      .catch((reason: unknown) => {
        if (active) setError(`Не удалось прочитать метаданные изображения: ${String(reason)}`);
      });
    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImage]);

  const children = useMemo(() => {
    if (filter === 'trash') {
      return entries.filter((entry) => entry.deletedAt !== null);
    }
    if (filter === 'favorites') {
      return entries.filter((entry) => entry.favorite && entry.deletedAt === null);
    }
    if (filter === 'duplicates') {
      const hashCounts = new Map<string, number>();
      Object.values(hashes).forEach((hash) => hashCounts.set(hash, (hashCounts.get(hash) ?? 0) + 1));
      const duplicateIds = new Set(
        Object.entries(hashes)
          .filter(([, hash]) => (hashCounts.get(hash) ?? 0) > 1)
          .map(([id]) => id)
      );
      return entries.filter((entry) => duplicateIds.has(entry.id) && !entry.deletedAt);
    }

    const folderChildren = entries.filter(
      (entry) => entry.parentId === activeFolderId && entry.deletedAt === null
    );
    const search = query.trim().toLocaleLowerCase();
    const source = search
      ? entries.filter((entry) => entry.deletedAt === null && entry.kind === 'file')
      : folderChildren;
    return source.filter((entry) => {
      const typeMatch =
        filter === 'images' ? isImage(entry) : filter === 'documents' ? isDocument(entry) : true;
      const queryMatch =
        !search ||
        entry.name.toLocaleLowerCase().includes(search) ||
        entry.tags.some((tag) => tag.toLocaleLowerCase().includes(search)) ||
        getEntryPath(entry, entries).toLocaleLowerCase().includes(search);
      return typeMatch && queryMatch;
    });
  }, [activeFolderId, entries, filter, hashes, query]);

  const folderPath = useMemo(() => {
    const path: WorkspaceEntry[] = [];
    let current = activeFolder;
    while (current) {
      path.unshift(current);
      current = current.parentId
        ? entries.find((entry) => entry.id === current?.parentId && entry.kind === 'folder') ?? null
        : null;
    }
    return path;
  }, [activeFolder, entries]);

  const importFiles = useCallback(
    async (files: FileList | File[], destinationId: string | null = null) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;
      try {
        const batch: Array<{ path: string; data: Uint8Array; type: string }> = (await Promise.all(
          fileArray.map(async (file) => ({
            path: normalizeRelativePath(
              (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
            ),
            data: new Uint8Array(await file.arrayBuffer()),
            type: file.type || mimeFromName(file.name),
          }))
        )).filter((file) => file.path);
        if (batch.length === 0) {
          setError('Импорт не содержит допустимых относительных путей.');
          return;
        }
        setEntries((current) => {
          let nextEntries = [...current];
          batch.forEach(({ path, data, type }) => {
            const parts = path.split('/');
            let parentId: string | null = destinationId;
            parts.forEach((name, index) => {
              const isFolder = index < parts.length - 1;
              const existing = nextEntries.find(
                (entry) =>
                  entry.parentId === parentId &&
                  entry.name === name &&
                  entry.deletedAt === null &&
                  entry.kind === (isFolder ? 'folder' : 'file')
              );
              if (existing) {
                if (!isFolder) {
                  nextEntries = nextEntries.map((entry) =>
                    entry.id === existing.id
                      ? {
                          ...entry,
                          data,
                          mimeType: type,
                          size: data.byteLength,
                          modifiedAt: Date.now(),
                          history: [
                            ...entry.history,
                            ...(entry.data ? [{ savedAt: entry.modifiedAt, data: entry.data, size: entry.size }] : []),
                          ].slice(-20),
                        }
                      : entry
                  );
                } else {
                  parentId = existing.id;
                }
              } else {
                const newEntry = makeEntry(name, parentId, isFolder ? 'folder' : 'file', isFolder ? undefined : data, type);
                nextEntries.push(newEntry);
                parentId = isFolder ? newEntry.id : null;
              }
            });
          });
          return nextEntries;
        });
        setNotice(`Импортировано файлов: ${batch.length}`);
        setError(null);
      } catch (reason) {
        setError(`Импорт не завершён: ${String(reason)}`);
      }
    },
    []
  );

  const importArchive = useCallback(
    async (file: File, destinationId: string | null = null) => {
      try {
        const archive = await JSZip.loadAsync(file, { checkCRC32: true });
        const records = await Promise.all(
          Object.values(archive.files)
            .filter((item) => !item.dir && normalizeRelativePath(item.name))
            .map(async (item) => ({
              path: normalizeRelativePath(item.name),
              data: await item.async('uint8array'),
              type: mimeFromName(item.name),
            }))
        );
        setEntries((current) => {
          let nextEntries = [...current];
          records.forEach(({ path, data, type }) => {
            const parts = path.split('/');
            let parentId: string | null = destinationId;
            parts.forEach((name, index) => {
              if (!name) return;
              const isFolder = index < parts.length - 1;
              let existing = nextEntries.find(
                (entry) =>
                  entry.parentId === parentId &&
                  entry.name === name &&
                  entry.deletedAt === null &&
                  entry.kind === (isFolder ? 'folder' : 'file')
              );
              if (existing && !isFolder) {
                nextEntries = nextEntries.map((entry) =>
                  entry.id === existing?.id
                    ? {
                        ...entry,
                        data,
                        mimeType: type,
                        size: data.byteLength,
                        modifiedAt: Date.now(),
                        history: [
                          ...entry.history,
                          ...(entry.data ? [{ savedAt: entry.modifiedAt, data: entry.data, size: entry.size }] : []),
                        ].slice(-20),
                      }
                    : entry
                );
              } else if (existing) {
                parentId = existing.id;
              } else {
                existing = makeEntry(name, parentId, isFolder ? 'folder' : 'file', isFolder ? undefined : data, type);
                nextEntries.push(existing);
                parentId = isFolder ? existing.id : null;
              }
            });
          });
          return nextEntries;
        });
        setNotice(`Импортировано файлов из архива: ${records.length}`);
        setError(null);
      } catch (reason) {
        setError(`Не удалось прочитать архив: ${String(reason)}`);
      }
    },
    []
  );

  const onImportSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!files.length) return;
    if (files.length === 1 && /\.(zip|mcpack|mcaddon|mrpack|jar)$/i.test(files[0].name)) {
      await importArchive(files[0], activeFolderId);
    } else {
      await importFiles(files, activeFolderId);
    }
  };

  const createFolder = () => {
    const name = window.prompt('Название новой папки');
    if (!name) return;
    const cleanName = validateEntryName(name);
    if (!cleanName) {
      setError('Имя папки пустое или содержит недопустимые символы.');
      return;
    }
    if (entries.some((entry) => entry.parentId === activeFolderId && entry.name === cleanName && !entry.deletedAt)) {
      setError('В этой папке уже есть элемент с таким именем.');
      return;
    }
    const folder = makeEntry(cleanName, activeFolderId, 'folder');
    setEntries((current) => [...current, folder]);
    setSelectedId(folder.id);
  };

  const createTextFile = () => {
    const name = window.prompt('Имя файла (например, notes.txt)', 'notes.txt');
    if (!name) return;
    const cleanName = validateEntryName(name);
    if (!cleanName) {
      setError('Имя файла пустое или содержит недопустимые символы.');
      return;
    }
    if (entries.some((entry) => entry.parentId === activeFolderId && entry.name === cleanName && !entry.deletedAt)) {
      setError('В этой папке уже есть элемент с таким именем.');
      return;
    }
    const file = makeEntry(cleanName, activeFolderId, 'file', new TextEncoder().encode(''), mimeFromName(cleanName));
    setEntries((current) => [...current, file]);
    setSelectedId(file.id);
  };

  const renameEntry = (entry: WorkspaceEntry) => {
    const name = window.prompt('Новое имя', entry.name);
    if (!name) return;
    const cleanName = validateEntryName(name);
    if (!cleanName) {
      setError('Имя пустое или содержит недопустимые символы.');
      return;
    }
    if (cleanName === entry.name) return;
    if (entries.some((item) => item.id !== entry.id && item.parentId === entry.parentId && item.name === cleanName && !item.deletedAt)) {
      setError('Элемент с таким именем уже существует в этой папке.');
      return;
    }
    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              name: cleanName,
              mimeType: item.kind === 'file' ? mimeFromName(cleanName) : item.mimeType,
              modifiedAt: Date.now(),
            }
          : item
      )
    );
  };

  const getDescendantIds = (folderId: string, all: WorkspaceEntry[]): Set<string> => {
    const descendants = new Set<string>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      all.forEach((entry) => {
        if (entry.parentId && descendants.has(entry.parentId) && !descendants.has(entry.id)) {
          descendants.add(entry.id);
          changed = true;
        }
      });
    }
    return descendants;
  };

  const trashEntry = (entry: WorkspaceEntry) => {
    const idSet = entry.kind === 'folder' ? getDescendantIds(entry.id, entries) : new Set([entry.id]);
    const now = Date.now();
    setEntries((current) =>
      current.map((item) => (idSet.has(item.id) ? { ...item, deletedAt: now } : item))
    );
    if (selectedId && idSet.has(selectedId)) setSelectedId(null);
    setNotice('Перемещено в корзину');
  };

  const restoreEntry = (entry: WorkspaceEntry) => {
    const idSet = entry.kind === 'folder' ? getDescendantIds(entry.id, entries) : new Set([entry.id]);
    setEntries((current) =>
      current.map((item) => (idSet.has(item.id) ? { ...item, deletedAt: null } : item))
    );
  };

  const permanentlyDelete = (entry: WorkspaceEntry) => {
    if (!window.confirm(`Удалить «${entry.name}» без возможности восстановления?`)) return;
    const idSet = entry.kind === 'folder' ? getDescendantIds(entry.id, entries) : new Set([entry.id]);
    setEntries((current) => current.filter((item) => !idSet.has(item.id)));
    if (selectedId && idSet.has(selectedId)) setSelectedId(null);
    setNotice('Элемент удалён без возможности восстановления');
  };

  const toggleFavorite = (entry: WorkspaceEntry) => {
    setEntries((current) =>
      current.map((item) => (item.id === entry.id ? { ...item, favorite: !item.favorite } : item))
    );
  };

  const saveTags = (entry: WorkspaceEntry) => {
    const tags = Array.from(new Set(tagDraft.split(',').map((tag) => tag.trim()).filter(Boolean)));
    setEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, tags } : item)));
    setNotice('Теги сохранены');
  };

  const saveText = (entry: WorkspaceEntry) => {
    const data = new TextEncoder().encode(textDraft ?? '');
    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              data,
              size: data.byteLength,
              modifiedAt: Date.now(),
              history: [...item.history, ...(item.data ? [{ savedAt: item.modifiedAt, data: item.data, size: item.size }] : [])].slice(-20),
            }
          : item
      )
    );
    setNotice('Файл сохранён; предыдущая версия добавлена в историю');
  };

  const restoreVersion = (entry: WorkspaceEntry, versionIndex: number) => {
    const version = entry.history[versionIndex];
    if (!version) return;
    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              data: version.data,
              size: version.size,
              modifiedAt: Date.now(),
              history: [
                ...item.history,
                ...(item.data ? [{ savedAt: item.modifiedAt, data: item.data, size: item.size }] : []),
              ].slice(-20),
            }
          : item
      )
    );
    setShowHistory(false);
    setNotice('Предыдущая версия восстановлена');
  };

  const copyEntry = (entry: WorkspaceEntry) => {
    setClipboardId(entry.id);
    setClipboardAction('copy');
    setNotice(`Скопировано: ${entry.name}. Откройте папку назначения и нажмите «Вставить».`);
  };

  const cutEntry = (entry: WorkspaceEntry) => {
    setClipboardId(entry.id);
    setClipboardAction('move');
    setNotice(`Выбрано для перемещения: ${entry.name}. Откройте папку назначения и нажмите «Вставить».`);
  };

  const pasteEntry = () => {
    if (!clipboardId) return;
    const source = entries.find((entry) => entry.id === clipboardId);
    if (!source || source.deletedAt) return;
    if (clipboardAction === 'move') {
      if (moveEntry(source.id, activeFolderId)) {
        setClipboardId(null);
        setNotice('Элемент перемещён');
      }
      return;
    }
    if (source.kind === 'folder' && getDescendantIds(source.id, entries).has(activeFolderId ?? '')) {
      setError('Нельзя скопировать папку внутрь самой себя.');
      return;
    }
    const copies: WorkspaceEntry[] = [];
    const copyTree = (sourceId: string, parentId: string | null, suffix = ' copy'): string => {
      const sourceNode = entries.find((entry) => entry.id === sourceId);
      if (!sourceNode) return '';
      const desiredName = sourceNode.name + (sourceNode.id === source.id ? suffix : '');
      let uniqueName = desiredName;
      let copyNumber = 2;
      while (
        [...entries, ...copies].some(
          (entry) => entry.parentId === parentId && entry.name === uniqueName && !entry.deletedAt
        )
      ) {
        uniqueName = `${desiredName} (${copyNumber})`;
        copyNumber += 1;
      }
      const cloned = makeEntry(
        uniqueName,
        parentId,
        sourceNode.kind,
        sourceNode.data ? new Uint8Array(sourceNode.data) : undefined,
        sourceNode.mimeType
      );
      cloned.favorite = sourceNode.favorite;
      cloned.tags = [...sourceNode.tags];
      cloned.history = sourceNode.history.map((version) => ({
        ...version,
        data: new Uint8Array(version.data),
      }));
      copies.push(cloned);
      if (sourceNode.kind === 'folder') {
        entries
          .filter((entry) => entry.parentId === sourceNode.id && !entry.deletedAt)
          .forEach((child) => copyTree(child.id, cloned.id, ''));
      }
      return cloned.id;
    };
    const newId = copyTree(source.id, activeFolderId);
    if (newId) {
      setEntries((current) => [...current, ...copies]);
      setSelectedId(newId);
    }
    setNotice('Копия создана');
  };

  const moveEntry = (entryId: string, destinationId: string | null): boolean => {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry || entry.deletedAt) return false;
    if (entry.kind === 'folder' && (destinationId === entry.id || getDescendantIds(entry.id, entries).has(destinationId ?? ''))) {
      setError('Нельзя переместить папку внутрь самой себя.');
      return false;
    }
    if (entries.some((item) => item.parentId === destinationId && item.name === entry.name && item.id !== entry.id && !item.deletedAt)) {
      setError('В целевой папке уже есть элемент с таким именем.');
      return false;
    }
    setEntries((current) =>
      current.map((item) => (item.id === entry.id ? { ...item, parentId: destinationId, modifiedAt: Date.now() } : item))
    );
    return true;
  };

  const handleDrop = async (event: React.DragEvent, folderId: string | null) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length) {
      const archiveFiles = Array.from(files).filter((file) =>
        /\.(zip|mcpack|mcaddon|mrpack|jar)$/i.test(file.name)
      );
      const regularFiles = Array.from(files).filter((file) => !archiveFiles.includes(file));
      if (regularFiles.length) await importFiles(regularFiles, folderId);
      for (const archiveFile of archiveFiles) await importArchive(archiveFile, folderId);
      return;
    }
    const draggedId = event.dataTransfer.getData('text/file-entry-id');
    if (draggedId) moveEntry(draggedId, folderId);
  };

  const downloadEntry = (entry: WorkspaceEntry) => {
    const href = URL.createObjectURL(entryBlob(entry));
    const link = document.createElement('a');
    link.href = href;
    link.download = entry.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const exportZip = async () => {
    try {
      const zip = new JSZip();
      entries
        .filter((entry) => entry.deletedAt === null)
        .forEach((entry) => {
          const path = getEntryPath(entry, entries);
          if (entry.kind === 'folder') zip.folder(path);
          else zip.file(path, entry.data ?? new Uint8Array());
        });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = 'resource-pack.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      setNotice('Архив ресурс-пака сохранён');
      setError(null);
    } catch (reason) {
      setError(`Не удалось создать архив: ${String(reason)}`);
    }
  };

  const analyzeDuplicates = async () => {
    try {
      const fileEntries = entries.filter((entry) => entry.kind === 'file' && !entry.deletedAt && entry.data);
      const result: Record<string, string> = {};
      await Promise.all(
        fileEntries.map(async (entry) => {
          const bytes = entry.data!;
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          result[entry.id] = Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
        })
      );
      setHashes(result);
      const uniqueHashes = new Set(Object.values(result));
      const duplicateCount = Object.values(result).length - uniqueHashes.size;
      setNotice(duplicateCount ? `Найдено дубликатов: ${duplicateCount}` : 'Дубликатов не найдено');
      setFilter('duplicates');
      setError(null);
    } catch (reason) {
      setError(`Проверка дубликатов не удалась: ${String(reason)}`);
    }
  };

  const applyWatermark = async (entry: WorkspaceEntry) => {
    if (!watermark.trim()) {
      setError('Введите текст водяного знака или подписи.');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(entry.mimeType)) {
      setError('Водяной знак поддерживается для PNG, JPEG и WebP.');
      return;
    }
    let bitmap: ImageBitmap | null = null;
    try {
      const source = entryBlob(entry);
      bitmap = await createImageBitmap(source);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Браузер не предоставил 2D canvas-контекст.');
      context.drawImage(bitmap, 0, 0);
      context.globalAlpha = watermarkOpacity;
      context.font = `${Math.max(12, Math.floor(canvas.width / 24))}px sans-serif`;
      context.textAlign = 'right';
      context.textBaseline = 'bottom';
      context.lineWidth = Math.max(2, Math.floor(canvas.width / 256));
      context.strokeStyle = '#000000';
      context.fillStyle = '#ffffff';
      const x = canvas.width - Math.max(8, canvas.width * 0.03);
      const y = canvas.height - Math.max(8, canvas.height * 0.03);
      context.strokeText(watermark.trim(), x, y);
      context.fillText(watermark.trim(), x, y);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Не удалось сформировать изображение.'))), entry.mimeType)
      );
      if (blob.type !== entry.mimeType) {
        throw new Error(`Формат ${entry.mimeType} не поддерживается для записи браузером.`);
      }
      const data = new Uint8Array(await blob.arrayBuffer());
      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                data,
                size: data.byteLength,
                modifiedAt: Date.now(),
                history: [...item.history, ...(item.data ? [{ savedAt: item.modifiedAt, data: item.data, size: item.size }] : [])].slice(-20),
              }
            : item
        )
      );
      setNotice('Водяной знак применён; исходная версия сохранена в истории');
      setError(null);
    } catch (reason) {
      setError(`Не удалось добавить водяной знак: ${String(reason)}`);
    } finally {
      bitmap?.close();
    }
  };

  const countByFilter = (mode: FilterMode) => {
    if (mode === 'trash') return entries.filter((entry) => entry.deletedAt !== null).length;
    if (mode === 'favorites') return entries.filter((entry) => entry.favorite && !entry.deletedAt).length;
    if (mode === 'images') return entries.filter((entry) => isImage(entry) && !entry.deletedAt).length;
    if (mode === 'documents') return entries.filter((entry) => isDocument(entry) && !entry.deletedAt).length;
    return entries.filter((entry) => entry.kind === 'file' && !entry.deletedAt).length;
  };

  return (
    <TabLayout label="Файлы" id={4} icon={<Folder size={18} />}>
      <div
        className={`flex h-full min-h-0 flex-col gap-3 ${ready ? '' : 'pointer-events-none opacity-70'}`}
        aria-busy={!ready}
        onClick={() => contextMenu && setContextMenu(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => void handleDrop(event, activeFolderId)}
      >
        <input
          ref={importInputRef}
          type="file"
          multiple
          accept=".zip,.mcpack,.mcaddon,.mrpack,.jar,image/*,.json,.mcmeta,.txt,.md"
          className="hidden"
          onChange={(event) => void onImportSelection(event)}
        />
        <input
          onChange={(event) => {
            void importFiles(event.currentTarget.files ?? [], activeFolderId);
            event.currentTarget.value = '';
          }}
          type="file"
          multiple
          className="hidden"
          ref={(element) => {
            folderInputRef.current = element;
            element?.setAttribute('webkitdirectory', '');
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            void importFiles(event.currentTarget.files ?? [], activeFolderId);
            event.currentTarget.value = '';
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-700 bg-gray-900 p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-48 max-w-xl flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск файлов, папок и тегов"
                className="w-full rounded border border-gray-700 bg-gray-800 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-500"
                aria-label="Поиск файлов"
              />
            </div>
            <button onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} title="Переключить вид" className="rounded bg-gray-800 p-2 text-gray-300 hover:bg-gray-700">
              <List size={17} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              <Upload size={16} /> Импорт
            </button>
            <button onClick={() => folderInputRef.current?.click()} className="inline-flex items-center gap-2 rounded bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700">
              <FolderPlus size={16} /> Папка
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700">
              <FilePlus2 size={16} /> Файлы
            </button>
            <button onClick={createFolder} className="rounded bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700" title="Создать пустую папку">
              + Папка
            </button>
            <button onClick={createTextFile} className="rounded bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700" title="Создать текстовый файл">
              + Текст
            </button>
            <button onClick={exportZip} className="inline-flex items-center gap-2 rounded bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600">
              <Archive size={16} /> ZIP
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded border border-red-800 bg-red-950/70 px-3 py-2 text-sm text-red-200">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Закрыть сообщение об ошибке"><X size={16} /></button>
          </div>
        )}
        {notice && <div role="status" className="rounded border border-green-800 bg-green-950/50 px-3 py-2 text-sm text-green-200">{notice}</div>}

        <div className="flex min-h-0 flex-1 gap-3">
          <aside className="w-52 shrink-0 overflow-y-auto rounded border border-gray-700 bg-gray-900 p-2">
            <div className="mb-2 px-2 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">Ресурс-пак</div>
            <button
              onClick={() => { setFilter('all'); setActiveFolderId(null); }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void handleDrop(event, null)}
              className={`mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${filter === 'all' && activeFolderId === null ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              <Folder size={16} /> Все файлы
            </button>
            <button onClick={() => setFilter('favorites')} className={`mb-1 flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${filter === 'favorites' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
              <span className="flex items-center gap-2"><Heart size={16} /> Избранное</span><span>{countByFilter('favorites')}</span>
            </button>
            <button onClick={() => setFilter('images')} className={`mb-1 flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${filter === 'images' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
              <span className="flex items-center gap-2"><ImageIcon size={16} /> Изображения</span><span>{countByFilter('images')}</span>
            </button>
            <button onClick={() => setFilter('documents')} className={`mb-1 flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${filter === 'documents' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
              <span className="flex items-center gap-2"><FileText size={16} /> Документы</span><span>{countByFilter('documents')}</span>
            </button>
            <button onClick={() => void analyzeDuplicates()} className={`mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${filter === 'duplicates' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
              <Copy size={16} /> Дубликаты
            </button>
            <div className="my-3 border-t border-gray-700" />
            <div className="mb-2 px-2 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">Папки</div>
            <button onClick={() => { setFilter('all'); setActiveFolderId(null); }} className={`mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${activeFolderId === null && filter === 'all' ? 'text-blue-300' : 'text-gray-400 hover:bg-gray-800'}`}>
              <Folder size={15} /> Корень
            </button>
            {entries
              .filter((entry) => entry.kind === 'folder' && !entry.deletedAt)
              .map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => { setFilter('all'); setActiveFolderId(entry.id); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => void handleDrop(event, entry.id)}
                  className={`mb-1 flex w-full items-center gap-2 truncate rounded px-3 py-2 text-left text-sm ${activeFolderId === entry.id ? 'bg-blue-600/30 text-blue-200' : 'text-gray-400 hover:bg-gray-800'}`}
                  title={getEntryPath(entry, entries)}
                >
                  <Folder size={15} className="shrink-0" /> <span className="truncate">{getEntryPath(entry, entries)}</span>
                </button>
              ))}
            <div className="my-3 border-t border-gray-700" />
            <button onClick={() => setFilter('trash')} className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${filter === 'trash' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
              <span className="flex items-center gap-2"><Trash2 size={16} /> Корзина</span><span>{countByFilter('trash')}</span>
            </button>
            {clipboardId && (
              <button onClick={pasteEntry} className="mt-2 flex w-full items-center gap-2 rounded bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700">
                {clipboardAction === 'move' ? <ArrowDownToLine size={15} /> : <Copy size={15} />}
                {clipboardAction === 'move' ? 'Переместить сюда' : 'Вставить копию'}
              </button>
            )}
          </aside>

          <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded border border-gray-700 bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-700 px-3 py-2">
              <div className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm text-gray-400">
                <button onClick={() => { setFilter('all'); setActiveFolderId(null); }} className="shrink-0 hover:text-white">Ресурс-пак</button>
                {folderPath.map((folder) => (
                  <React.Fragment key={folder.id}>
                    <ChevronRight size={14} className="shrink-0" />
                    <button onClick={() => setActiveFolderId(folder.id)} className="max-w-40 shrink-0 truncate hover:text-white">{folder.name}</button>
                  </React.Fragment>
                ))}
              </div>
              <div className="text-xs text-gray-500">{ready ? `${children.length} элементов` : 'Загрузка…'} · {formatBytes(entries.filter((entry) => entry.kind === 'file' && !entry.deletedAt).reduce((total, entry) => total + entry.size, 0))}</div>
            </div>

            <div className={`min-h-0 flex-1 overflow-auto p-2 ${viewMode === 'grid' ? 'grid auto-rows-max grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4' : 'space-y-1'}`}>
              {!ready && <div className="p-6 text-center text-sm text-gray-500">Открываю локальную библиотеку…</div>}
              {ready && children.length === 0 && (
                <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm text-gray-500">
                  <Folder size={34} />
                  {filter === 'trash' ? 'Корзина пуста' : query ? 'Ничего не найдено' : 'Папка пуста. Перетащите сюда файлы или импортируйте их.'}
                </div>
              )}
              {children.map((entry) => (
                <div
                  key={entry.id}
                  draggable={!entry.deletedAt}
                  onDragStart={(event) => event.dataTransfer.setData('text/file-entry-id', entry.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                      setContextMenu({
                        entryId: entry.id,
                        x: Math.max(0, Math.min(event.clientX, window.innerWidth - 190)),
                        y: Math.max(0, Math.min(event.clientY, window.innerHeight - 250)),
                      });
                    }}
                  onDragOver={(event) => { if (entry.kind === 'folder') event.preventDefault(); }}
                  onDrop={(event) => { event.stopPropagation(); void handleDrop(event, entry.kind === 'folder' ? entry.id : entry.parentId); }}
                  className={`group flex min-w-0 items-center gap-3 rounded border px-3 py-2 transition ${
                    selectedId === entry.id ? 'border-blue-500 bg-blue-950/50' : 'border-transparent bg-gray-800/70 hover:border-gray-700'
                  } ${viewMode === 'grid' ? 'flex-col items-stretch' : ''}`}
                >
                  <button
                    onClick={() => entry.kind === 'folder' && filter === 'all' && !query ? setActiveFolderId(entry.id) : setSelectedId(entry.id)}
                    className={`flex min-w-0 flex-1 items-center gap-3 text-left ${viewMode === 'grid' ? 'flex-col' : ''}`}
                  >
                    {entry.kind === 'folder' ? <Folder size={20} className="shrink-0 text-amber-400" /> : isImage(entry) ? <FileImage size={20} className="shrink-0 text-emerald-400" /> : <File size={20} className="shrink-0 text-blue-300" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-100">{entry.name}</span>
                      <span className="block truncate text-xs text-gray-500">{filter === 'trash' ? 'В корзине' : entry.kind === 'folder' ? 'Папка' : `${formatBytes(entry.size)} · ${new Date(entry.modifiedAt).toLocaleString()}`}</span>
                    </span>
                  </button>
                  {entry.favorite && <Heart size={14} className="shrink-0 fill-rose-400 text-rose-400" />}
                  {entry.tags.slice(0, 2).map((tag) => <span key={tag} className="hidden rounded bg-purple-900/70 px-2 py-0.5 text-[10px] text-purple-200 md:inline">{tag}</span>)}
                  {filter === 'trash' ? (
                    <>
                      <button onClick={() => restoreEntry(entry)} title="Восстановить" className="rounded p-1.5 text-green-300 hover:bg-gray-700"><RotateCcw size={15} /></button>
                      <button onClick={() => permanentlyDelete(entry)} title="Удалить навсегда" className="rounded p-1.5 text-red-300 hover:bg-gray-700"><Trash2 size={15} /></button>
                    </>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1 opacity-70 group-hover:opacity-100">
                      <button onClick={() => toggleFavorite(entry)} title="Избранное" className={`rounded p-1.5 hover:bg-gray-700 ${entry.favorite ? 'text-rose-400' : 'text-gray-400'}`}><Heart size={15} /></button>
                      <button onClick={() => copyEntry(entry)} title="Копировать" className="rounded p-1.5 text-gray-400 hover:bg-gray-700"><Copy size={15} /></button>
                      <button onClick={() => renameEntry(entry)} title="Переименовать" className="rounded p-1.5 text-gray-400 hover:bg-gray-700"><Pencil size={15} /></button>
                      <button onClick={() => trashEntry(entry)} title="В корзину" className="rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-red-300"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <aside className="w-80 shrink-0 overflow-y-auto rounded border border-gray-700 bg-gray-900 p-3">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-500">
                <MoreHorizontal size={32} className="mb-2" />
                Выберите файл, чтобы посмотреть содержимое и свойства.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-all text-sm font-semibold text-white">{selected.name}</h3>
                    <p className="mt-1 break-all text-xs text-gray-500">{getEntryPath(selected, entries)}</p>
                  </div>
                  <button onClick={() => setSelectedId(null)} title="Закрыть предпросмотр" className="rounded p-1 text-gray-400 hover:bg-gray-800"><X size={16} /></button>
                </div>

                {isImage(selected) && previewUrl && (
                  <div className="overflow-hidden rounded border border-gray-700 bg-[linear-gradient(45deg,#1f2937_25%,transparent_25%),linear-gradient(-45deg,#1f2937_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f2937_75%),linear-gradient(-45deg,transparent_75%,#1f2937_75%)] bg-[length:20px_20px]">
                    <img src={previewUrl} alt={`Предпросмотр ${selected.name}`} className="mx-auto max-h-64 max-w-full object-contain" />
                  </div>
                )}

                {isDocument(selected) && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-400">Содержимое файла</label>
                    <textarea
                      value={textDraft ?? ''}
                      onChange={(event) => setTextDraft(event.target.value)}
                      className="h-48 w-full resize-y rounded border border-gray-700 bg-gray-950 p-2 font-mono text-xs text-gray-200 outline-none focus:border-blue-500"
                    />
                    <button onClick={() => saveText(selected)} className="mt-2 inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"><Check size={14} /> Сохранить</button>
                  </div>
                )}

                <dl className="grid grid-cols-2 gap-y-2 border-y border-gray-800 py-3 text-xs">
                  <dt className="text-gray-500">Тип</dt><dd className="truncate text-gray-300">{selected.mimeType}</dd>
                  <dt className="text-gray-500">Размер</dt><dd className="text-gray-300">{formatBytes(selected.size)}</dd>
                  <dt className="text-gray-500">Изменён</dt><dd className="text-gray-300">{new Date(selected.modifiedAt).toLocaleString()}</dd>
                  <dt className="text-gray-500">Версий</dt><dd className="text-gray-300">{selected.history.length}</dd>
                </dl>

                {isImage(selected) && (
                  <div className="space-y-1 rounded bg-gray-800/70 p-2 text-xs">
                    <div className="font-semibold text-gray-300">Метаданные изображения</div>
                    {imageMetadata?.entryId === selected.id ? (
                      <>
                        <div className="text-gray-400">Размеры: {imageMetadata.width} × {imageMetadata.height}px</div>
                        <div className="break-words text-gray-400">EXIF: {imageMetadata.exif.length ? imageMetadata.exif.join(' · ') : 'не найден'}</div>
                        <div className="break-words text-gray-400">XMP: {imageMetadata.xmp ? imageMetadata.xmp.slice(0, 240) : 'не найден'}</div>
                        {imageMetadata.pngText.map((text, index) => <div key={`${index}-${text}`} className="break-all text-gray-500">PNG: {text.slice(0, 180)}</div>)}
                      </>
                    ) : (
                      <div className="text-gray-500">Чтение метаданных…</div>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-400"><Tag size={14} /> Теги через запятую</label>
                  <div className="flex gap-2">
                    <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white" />
                    <button onClick={() => saveTags(selected)} title="Сохранить теги" className="rounded bg-gray-700 px-2 text-gray-200 hover:bg-gray-600"><Check size={14} /></button>
                  </div>
                </div>

                {isImage(selected) && (
                  <div className="space-y-2 border-t border-gray-800 pt-3">
                    <label className="block text-xs font-semibold text-gray-400">Водяной знак / подпись</label>
                    <input value={watermark} onChange={(event) => setWatermark(event.target.value)} placeholder="Текст подписи" className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-white" />
                    <label className="block text-xs text-gray-500">Прозрачность: {Math.round(watermarkOpacity * 100)}%</label>
                    <input type="range" min="0.1" max="1" step="0.05" value={watermarkOpacity} onChange={(event) => setWatermarkOpacity(Number(event.target.value))} className="w-full" />
                    <button onClick={() => void applyWatermark(selected)} className="w-full rounded bg-purple-700 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-600">Применить (исходник сохранится в истории)</button>
                  </div>
                )}

                {selected.history.length > 0 && (
                  <div>
                    <button onClick={() => setShowHistory(!showHistory)} className="mb-2 flex w-full items-center justify-between text-xs font-semibold text-gray-300">
                      <span className="flex items-center gap-2"><RotateCcw size={14} /> История версий</span><span>{showHistory ? '−' : '+'}</span>
                    </button>
                    {showHistory && (
                      <div className="space-y-1">
                        {[...selected.history].reverse().map((version, reversedIndex) => {
                          const versionIndex = selected.history.length - reversedIndex - 1;
                          return (
                            <div key={`${selected.id}-${version.savedAt}-${versionIndex}`} className="flex items-center justify-between gap-2 rounded bg-gray-800 px-2 py-2 text-xs">
                              <span className="truncate text-gray-400">{new Date(version.savedAt).toLocaleString()} · {formatBytes(version.size)}</span>
                              <button onClick={() => restoreVersion(selected, versionIndex)} className="shrink-0 text-blue-300 hover:text-blue-200">Вернуть</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {selected.kind === 'file' && (
                  <button onClick={() => downloadEntry(selected)} className="inline-flex w-full items-center justify-center gap-2 rounded bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700">
                    <ArrowDownToLine size={16} /> Скачать файл
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>Рабочая область сохраняется локально в браузерном IndexedDB. Экспорт ZIP включает файлы вне корзины.</span>
          {filter === 'trash' && <span><ShieldAlert size={13} className="mr-1 inline" /> Удаление пока обратимо: восстановите файлы из корзины.</span>}
        </footer>
        {contextMenu && (
          <div
            role="menu"
            className="fixed z-50 min-w-44 rounded border border-gray-600 bg-gray-800 p-1 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const entry = entries.find((item) => item.id === contextMenu.entryId);
              if (!entry) return null;
              return (
                <>
                  <button role="menuitem" onClick={() => { setSelectedId(entry.id); setContextMenu(null); }} className="w-full rounded px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-700">Открыть свойства</button>
                  <button role="menuitem" onClick={() => { copyEntry(entry); setContextMenu(null); }} className="w-full rounded px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-700">Копировать</button>
                  <button role="menuitem" onClick={() => { cutEntry(entry); setContextMenu(null); }} className="w-full rounded px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-700">Вырезать / переместить</button>
                  <button role="menuitem" onClick={() => { renameEntry(entry); setContextMenu(null); }} className="w-full rounded px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-700">Переименовать</button>
                  <button role="menuitem" onClick={() => { toggleFavorite(entry); setContextMenu(null); }} className="w-full rounded px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-700">{entry.favorite ? 'Убрать из избранного' : 'В избранное'}</button>
                  <button role="menuitem" onClick={() => { trashEntry(entry); setContextMenu(null); }} className="w-full rounded px-3 py-2 text-left text-xs text-red-300 hover:bg-gray-700">Переместить в корзину</button>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </TabLayout>
  );
};

export default FileManagerTab;
