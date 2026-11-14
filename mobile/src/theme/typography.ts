import { TextStyle } from 'react-native';
import { colors } from './colors';
import { fonts } from './fonts';

const REGULAR = fonts.regular;
const MEDIUM = fonts.medium;
const SEMIBOLD = fonts.semibold;
const BOLD = fonts.bold;

type TypographyName =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'button'
  | 'price';

export const typography: Record<TypographyName, TextStyle> = {
  display: {
    fontFamily: BOLD,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -0.5,
    color: colors.text,
  },
  title: {
    fontFamily: BOLD,
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: colors.text,
  },
  heading: {
    fontFamily: SEMIBOLD,
    fontSize: 19,
    lineHeight: 26,
    color: colors.text,
  },
  body: {
    fontFamily: REGULAR,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  bodyStrong: {
    fontFamily: SEMIBOLD,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  caption: {
    fontFamily: REGULAR,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  label: {
    fontFamily: MEDIUM,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  button: {
    fontFamily: SEMIBOLD,
    fontSize: 16,
    lineHeight: 22,
  },
  price: {
    fontFamily: BOLD,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
};