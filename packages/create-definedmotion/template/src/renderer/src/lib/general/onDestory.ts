let allDestroyFunctionsToCall: (() => any)[] = []

export const addDestroyFunction = (func: () => any) => allDestroyFunctionsToCall.push(func)

export const callAllDestroyFunctions = async () => {
  for (let i = 0; i < allDestroyFunctionsToCall.length; i++) {
    await allDestroyFunctionsToCall[i]()
  }
  allDestroyFunctionsToCall = []
}
