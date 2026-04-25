export const formatTenderDate = (value?: string | null): string => {
  if (!value) return "";
  const str = String(value);
  return str.includes("T") ? str.split("T")[0] : str;
};

export const isTenderExpired = (dateValue?: string | null): boolean => {
  if (!dateValue) return false;

  const dateStr = formatTenderDate(dateValue);
  if (!dateStr) return false;

  const due = new Date(dateStr);
  due.setHours(23, 59, 59, 999);

  const now = new Date();

  return due.getTime() < now.getTime();
};
