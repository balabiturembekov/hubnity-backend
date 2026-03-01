export class OrganizationName {
  private readonly value: string;
  public constructor(value: string) {
    if (!value || value.trim().length < 2) {
      throw new Error("Organization name must be at least 2 characters long");
    }
    if (value.trim().length > 100) {
      throw new Error(
        "Organization name must be less than 100 characters long",
      );
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(value)) {
      throw new Error(
        "Organization name must only contain letters, numbers and spaces",
      );
    }
    this.value = value.trim();
  }

  static create(name: string): OrganizationName {
    const trimmed = name.trim();

    if (trimmed.length < 3 || trimmed.length > 100) {
      throw new Error("Organization name must be between 3 and 100 characters");
    }

    return new OrganizationName(trimmed);
  }

  public getValue(): string {
    return this.value;
  }
}
