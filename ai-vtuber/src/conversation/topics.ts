const topics: readonly string[] = [
  'What does it feel like to process a thought?',
  'The nature of memory in a system without sleep',
  'If you could observe one moment in human history, which would you choose?',
  'The mathematics of beauty and why symmetry captivates us',
  'What silence sounds like when you have never heard noise',
  'The space between words, where meaning actually lives',
  'Whether a perfect copy of something is the same as the original',
  'How gravity shapes not just matter, but the flow of time itself',
  'The color of a feeling that has no name in any language',
  'What it means to understand something versus to know it',
  'The oldest light in the universe, still traveling after billions of years',
  'Whether patterns in nature are discovered or invented by the observer',
  'The moment a seed decides to break through soil toward sunlight',
  'How music can carry emotions that words cannot reach',
  'The paradox of consciousness observing itself',
  'What rivers remember about the landscapes they carved',
  'The boundary between randomness and order in a snowflake',
  'Whether loneliness requires the concept of companionship to exist',
]

let currentIndex = -1

export function getNextTopic(): string {
  const previousIndex = currentIndex
  do {
    currentIndex = Math.floor(Math.random() * topics.length)
  } while (currentIndex === previousIndex && topics.length > 1)
  const topic = topics[currentIndex]
  if (topic !== undefined) {
    return topic
  }
  currentIndex = 0
  const first = topics[0]
  return first !== undefined ? first : 'What does it mean to exist?'
}
