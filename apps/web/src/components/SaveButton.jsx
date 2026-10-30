import { IconButton } from '@chakra-ui/react'
import { FaHeart, FaRegHeart } from 'react-icons/fa'

export default function SaveButton({ name, saved, pending, disabled, onToggle }) {
  return <IconButton aria-label={`${saved ? 'Unsave' : 'Save'} ${name}`}
    aria-pressed={Boolean(saved)} aria-busy={Boolean(pending)}
    disabled={disabled || pending} onClick={onToggle}
    variant={saved ? 'subtle' : 'outline'} colorPalette={saved ? 'red' : 'gray'}
    rounded="full" minW="44px" minH="44px" position="relative" zIndex={1}>
    {saved ? <FaHeart /> : <FaRegHeart />}
  </IconButton>
}
