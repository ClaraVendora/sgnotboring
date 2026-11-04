const formatter = new Intl.DateTimeFormat('en-SG', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore',
})

export const reviewDateLabel = (date) => formatter.format(new Date(date))
