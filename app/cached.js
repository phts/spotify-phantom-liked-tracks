const cache = {}

export async function cached(func, key) {
  if (cache[key]) {
    return cache[key]
  }
  const result = await func()
  cache[key] = result
  return result
}
