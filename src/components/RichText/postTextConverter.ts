import {
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE,
  type SerializedTextNode,
} from 'lexical'
import { createElement, type CSSProperties, type ReactNode } from 'react'

import { postFontSizeStyles, postTextColorStyles } from '@/fields/postTextStyles'

type PostTextState = {
  color?: string
  fontSize?: string
}

export type SerializedPostTextNode = SerializedTextNode & {
  $?: PostTextState
}

const getApprovedStyle = (state?: PostTextState) => {
  const style: CSSProperties = {}
  const dataAttributes: Record<string, string> = {}

  if (state?.color && state.color in postTextColorStyles) {
    const colorKey = state.color as keyof typeof postTextColorStyles
    style.color = postTextColorStyles[colorKey].css.color
    dataAttributes['data-text-color'] = colorKey
  }

  if (state?.fontSize && state.fontSize in postFontSizeStyles) {
    const fontSize = state.fontSize as keyof typeof postFontSizeStyles
    style.fontSize = postFontSizeStyles[fontSize].css['font-size']
    dataAttributes['data-font-size'] = fontSize
  }

  return {
    dataAttributes,
    style,
    hasApprovedStyle: Object.keys(style).length > 0,
  }
}

export const renderPostTextNode = (node: SerializedPostTextNode): ReactNode => {
  let text: ReactNode = node.text

  if (node.format & IS_BOLD) text = createElement('strong', null, text)
  if (node.format & IS_ITALIC) text = createElement('em', null, text)
  if (node.format & IS_STRIKETHROUGH) {
    text = createElement('span', { style: { textDecoration: 'line-through' } }, text)
  }
  if (node.format & IS_UNDERLINE) {
    text = createElement('span', { style: { textDecoration: 'underline' } }, text)
  }
  if (node.format & IS_CODE) text = createElement('code', null, text)
  if (node.format & IS_SUBSCRIPT) text = createElement('sub', null, text)
  if (node.format & IS_SUPERSCRIPT) text = createElement('sup', null, text)

  const { dataAttributes, hasApprovedStyle, style } = getApprovedStyle(node.$)

  return hasApprovedStyle ? createElement('span', { ...dataAttributes, style }, text) : text
}
