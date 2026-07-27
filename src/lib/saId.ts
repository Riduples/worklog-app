// South African ID number utilities. A 13-digit SA ID begins with the date of
// birth as YYMMDD. The century is inferred with a pivot: a two-digit year later
// than the current two-digit year is treated as 19xx, otherwise 20xx (so a 2026
// run reads "05" as 2005 and "60" as 1960).

export function dobFromSaId(idNumber: string | null | undefined): string | null {
  if (!idNumber) return null;
  const digits = idNumber.replace(/\D/g, "");
  if (digits.length < 6) return null;
  const yy = parseInt(digits.slice(0, 2), 10);
  const mm = parseInt(digits.slice(2, 4), 10);
  const dd = parseInt(digits.slice(4, 6), 10);
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const currentYY = new Date().getFullYear() % 100;
  const year = (yy > currentYY ? 1900 : 2000) + yy;
  const iso = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  // Reject impossible dates (e.g. 31 Feb) by round-tripping through Date.
  const d = new Date(`${iso}T00:00:00`);
  if (d.getFullYear() !== year || d.getMonth() + 1 !== mm || d.getDate() !== dd) return null;
  return iso;
}

export function ageFromSaId(idNumber: string | null | undefined, asOf?: Date): number | null {
  const dob = dobFromSaId(idNumber);
  if (!dob) return null;
  const ref = asOf ?? new Date();
  const b = new Date(`${dob}T00:00:00`);
  let age = ref.getFullYear() - b.getFullYear();
  const m = ref.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
  return age;
}
