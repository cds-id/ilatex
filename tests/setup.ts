class ResizeObserverMock {
	public observe(): void {}
	public unobserve(): void {}
	public disconnect(): void {}
}

Object.defineProperty( window, 'ResizeObserver', {
	writable: true,
	configurable: true,
	value: ResizeObserverMock
} );

Object.defineProperty( globalThis, 'ResizeObserver', {
	writable: true,
	configurable: true,
	value: ResizeObserverMock
} );

Object.defineProperty( window, 'scrollTo', {
	writable: true,
	configurable: true,
	value: () => {}
} );
