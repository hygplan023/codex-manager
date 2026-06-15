import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function formatDate(timestamp: number | string | Date) {
  let date: Date;
  if (typeof timestamp === 'number') {
    // Check if timestamp is in seconds or milliseconds
    date = new Date(timestamp > 1e11 ? timestamp : timestamp * 1000);
  } else {
    date = new Date(timestamp);
  }
  return format(date, "yyyy-MM-dd HH:mm:ss");
}

export function formatRelative(timestamp: number | string | Date) {
  let date: Date;
  if (typeof timestamp === 'number') {
    // Check if timestamp is in seconds or milliseconds
    date = new Date(timestamp > 1e11 ? timestamp : timestamp * 1000);
  } else {
    date = new Date(timestamp);
  }
  return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
}
