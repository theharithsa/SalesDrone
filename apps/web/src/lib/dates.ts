const localMinute = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export function localInstant(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()) || localMinute(date) !== value.slice(0, 16))
    throw Error(
      'This local time does not exist. Choose another time around the clock change.',
    );
  for (const offset of [-120, -60, -30, 30, 60, 120])
    if (
      localMinute(new Date(date.valueOf() + offset * 60000)) ===
      value.slice(0, 16)
    )
      throw Error(
        'This time occurs twice during a clock change. Choose an unambiguous time, or reschedule using an explicit UTC offset.',
      );
  return date.toISOString();
}
