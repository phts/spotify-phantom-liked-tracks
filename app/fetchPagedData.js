const limit = 50

export async function fetchPagedData(
  api,
  method,
  {requiredArgs = [], options, paginationType = 'offset'},
  {getItems = (d) => d.body?.items || [], onData, onEnd = () => {}}
) {
  let offset = 0
  let after

  const nextPage = {
    offset: () => (offset += limit),
    after: (items) => (after = items[items.length - 1].id),
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await api[method](...[...requiredArgs, {...options, limit, offset, after}])
    const items = getItems(data)
    if (!items.length) {
      onEnd()
      break
    }
    onData(items)
    if (items.length < limit) {
      onEnd()
      break
    }
    nextPage[paginationType](items)
  }
}
