export interface ModuleMetadata {
  readonly imports?: readonly unknown[];
  readonly controllers?: readonly unknown[];
  readonly providers?: readonly unknown[];
}

const moduleMetadataKey = Symbol('module:metadata');

export function Module(metadata: ModuleMetadata): ClassDecorator {
  return (target) => {
    Object.defineProperty(target, moduleMetadataKey, {
      configurable: false,
      enumerable: false,
      value: metadata,
      writable: false,
    });
  };
}

export function Controller(_path = ''): ClassDecorator {
  return () => {
    // Intentional no-op: the file only needs Nest-like shape for now.
  };
}

export function Injectable(): ClassDecorator {
  return () => {
    // Intentional no-op: the file only needs Nest-like shape for now.
  };
}

export function getModuleMetadata(target: object): ModuleMetadata | undefined {
  return (target as Record<symbol, ModuleMetadata | undefined>)[moduleMetadataKey];
}
