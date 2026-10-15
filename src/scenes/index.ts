import type { Director } from '../director'
import { intro } from './intro'
import { rnn } from './rnn'
import { seq2seq } from './seq2seq'
import { attention } from './attention'
import { paper } from './paper'
import { selfattn } from './selfattn'
import { parallel } from './parallel'
import { arch } from './arch'
import { split } from './split'
import { scale } from './scale'
import { tokens } from './tokens'
import { chat } from './chat'
import { now } from './now'

/** 按播放顺序排列的场景 */
export const SCENES: ((d: Director) => void)[] = [
  intro, // 开场：Clawd 从欢迎框里跳出来
  rnn, // 前世：RNN / LSTM
  seq2seq, // 前世：Seq2Seq 与信息瓶颈
  attention, // 转机：注意力机制
  paper, // 诞生：Attention Is All You Need
  selfattn, // 核心：自注意力 Q K V
  parallel, // 核心：并行、位置编码、多头
  arch, // 核心：完整结构
  split, // 今生：BERT 与 GPT
  scale, // 今生：规模定律
  tokens, // 今生：万物皆可 token
  chat, // 今生：RLHF、ChatGPT、Claude
  now, // 今天与明天 + 片尾
]
