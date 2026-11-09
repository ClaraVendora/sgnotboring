import { Box, Heading, HStack, Stack, Text } from '@chakra-ui/react'
import { useCurrentMinute } from '../hooks/useOpenStatus.js'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export default function WeeklyHours({ hours }) {
  const minute = useCurrentMinute()
  const today = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'Asia/Singapore' }).format(new Date(minute))
  const descriptions = Array.isArray(hours?.weekdayDescriptions)
    ? hours.weekdayDescriptions.filter((line) => typeof line === 'string' && line.trim()) : []
  return <Stack gap={2}>
    <Heading size="md">Opening hours</Heading>
    <Text fontSize="xs" color="fg.muted">Singapore time</Text>
    {!descriptions?.length ? <Text>Opening hours unavailable</Text> : days.map((day) => {
      const description = descriptions.find((line) => line.startsWith(`${day}:`))
      return <HStack key={day} justify="space-between" align="start" gap={4} p={2} rounded="md"
        bg={day === today ? 'blue.subtle' : undefined} fontWeight={day === today ? 'bold' : undefined}>
        <Box><Text>{day}{day === today ? ' (Today)' : ''}</Text></Box>
        <Text textAlign="right">{description ? description.slice(day.length + 1).trim() : 'Unavailable'}</Text>
      </HStack>
    })}
  </Stack>
}
