type DestroyFunction = () => unknown | Promise<unknown>

const allDestroyFunctionsToCall = new Set<DestroyFunction>()

export const addDestroyFunction = (func: DestroyFunction): (() => void) => {
  allDestroyFunctionsToCall.add(func)
  return () => allDestroyFunctionsToCall.delete(func)
}

export const callAllDestroyFunctions = async (): Promise<void> => {
  const functions = [...allDestroyFunctionsToCall]
  allDestroyFunctionsToCall.clear()
  for (const destroy of functions) {
    await destroy()
  }
}
