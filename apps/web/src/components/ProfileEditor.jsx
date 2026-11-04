import { useId, useState } from 'react'
import { Box, Button, Field, HStack, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { PROFILE_ICONS, profileIcon, validateProfile } from '../lib/profile.js'

export default function ProfileEditor({ name, email, icon, pending, onSave, onCancel }) {
  const id = useId()
  const [fields, setFields] = useState({ name: name ?? '', email, icon: profileIcon(icon).id })
  const [validation, setValidation] = useState('')
  const update = (key, value) => { setFields((previous) => ({ ...previous, [key]: value })); setValidation('') }
  async function submit(event) {
    event.preventDefault()
    const error = validateProfile(fields)
    if (error) { setValidation(error); return }
    if (await onSave(fields)) onCancel()
  }
  return <Stack as="form" onSubmit={submit} gap={4} noValidate>
    <Field.Root>
      <Field.Label>Display name</Field.Label>
      <Input value={fields.name} autoComplete="nickname" maxLength={60} disabled={pending} onChange={(event) => update('name', event.target.value)} />
    </Field.Root>
    <Field.Root required>
      <Field.Label>Email <Field.RequiredIndicator /></Field.Label>
      <Input type="email" value={fields.email} autoComplete="email" maxLength={254} disabled={pending} onChange={(event) => update('email', event.target.value)} />
      <Field.HelperText>Email changes may need confirmation at your current and new addresses.</Field.HelperText>
    </Field.Root>
    <Box as="fieldset" border="0" p={0} m={0} disabled={pending}>
      <Text as="legend" fontWeight="medium" mb={2}>Profile icon</Text>
      <SimpleGrid columns={4} gap={2}>
        {PROFILE_ICONS.map((choice) => <Box as="label" key={choice.id} position="relative" cursor="pointer"
          borderWidth="2px" borderColor={fields.icon === choice.id ? 'blue.solid' : 'border'}
          bg={fields.icon === choice.id ? 'blue.subtle' : 'bg.panel'} rounded="lg" py={3} textAlign="center"
          _focusWithin={{ outline: '2px solid', outlineColor: 'blue.solid', outlineOffset: '2px' }}>
          <input type="radio" name={`${id}-icon`} aria-label={choice.label} checked={fields.icon === choice.id}
            onChange={() => update('icon', choice.id)}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', margin: 0, cursor: 'inherit' }} />
          <Text fontSize="2xl" aria-hidden="true">{choice.symbol || 'Aa'}</Text>
          <Text fontSize="xs">{choice.label}</Text>
        </Box>)}
      </SimpleGrid>
    </Box>
    {validation && <Text role="alert" color="fg.error">{validation}</Text>}
    <HStack flexWrap="wrap">
      <Button type="submit" colorPalette="blue" disabled={pending} loading={pending}>Save profile</Button>
      <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>Cancel</Button>
    </HStack>
  </Stack>
}
