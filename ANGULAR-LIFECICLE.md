- Instance construction & OnDestroy callback registration
- First change detection: Inputs and Models are set and ngOnInit is called <- but maybe we want to do it here?
- Effects run <- We are subscribing always here, but maybe in an effect that is too late

1. Calling the signal can fail because signals might not be ready yet, so we need to delay the read. This is a big ussue with components.
2. Usign effects for subscriptions might end up with a subscription that start to late, it might be expected before of ngOnInit or on an earlier effect. This is an issue when something needs to run as earlier as posible, witch isn't usually the case, but breaks for example mutations on first renders of components.
3. On Destroy can't be registered on something that hasn't been initialized yet. The cleanup should be registered or enabled when the thing is initialized. Usually effects for syncing options initialize the thing, so this isn't an issue in real applications but it might be in tests with really specific conditions.
4. The setup "effect" might have reactive values, and we should be able to react to them. A simple callback with unsubscribe on destroy does not cover the case when that initialization effect depends on other signals. See isRestoring of base query.

Should we guard late reads?
