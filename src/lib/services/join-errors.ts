export class CannotJoinOwnedGroupError extends Error {
  constructor(resourceName = "group") {
    super(`You cannot join a ${resourceName} you created.`);
    this.name = "CannotJoinOwnedGroupError";
  }
}
