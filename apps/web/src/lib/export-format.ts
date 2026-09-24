/** Поля вложений включены в JSON-экспорт. Бинарные файлы остаются на диске. */
export interface ExportedAttachment {
  id: string;
  ownerType: string;
  ownerId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
}

export const EXPORT_ATTACHMENTS_NOTE =
  "Вложения перечислены только как метаданные. Их бинарное содержимое находится в директории данных (JOURNAL_DATA_DIR, по умолчанию ./data), которая остаётся полной резервной копией.";

/**
 * Удалить бинарные файлы вложений из строки экспорта. Встраивание каждого файла (до
 * 8 МБ каждый) как base64 в один JSON-документ в памяти может исчерпать память, поэтому
 * экспорт содержит только метаданные.
 */
export const attachmentExportRecord = (row: {
  id: string;
  ownerType: string;
  ownerId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
}): ExportedAttachment => ({
  id: row.id,
  ownerType: row.ownerType,
  ownerId: row.ownerId,
  name: row.name,
  mime: row.mime,
  size: row.size,
  createdAt: row.createdAt,
});