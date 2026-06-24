# Cesium Ion

Cesium Ion is the asset gateway used by LGS1920 to access hosted geospatial data.

## Why is a Cesium account required?

LGS1920 relies on Cesium Ion as a technical platform for maps and layers.  
To use it, you need a Cesium Ion account because those resources are delivered through Cesium's service.
By default, the LGS1920 app offers a shared token with limited usage, which allows you to test the app.
If you enjoy it, you can use a personal token **to continue using the app with your own quotas**.

Cesium offers a **free account tier** with limited usage. There are also paid plans with higher usage limits. This help text is informational only and does not promote any commercial offer.

**LGS1920 has no affiliation with Cesium** beyond this technical integration.

## What does this unlock?

- Cesium Ion-hosted assets like terrain and imagery (Cesium 3D Tiles and imagery layers,Google Photorealistic, Azure (ex Bing) Maps and more)
- future Ion-connected layers without hardcoding a single provider token in the app
- content that is gated by your own Cesium entitlements instead of the shared application token

## Why does your own token matter?

The shared application token is convenient for first use, but it is **not meant for long sessions** or **repeated production**
usage.

By entering your own Cesium Ion token:

- you keep your Ion activity under your own account
- the application can keep using your own access rights after the shared allowance is consumed
- the token is persisted until you decide to remove it
- the app can keep loading layers that are tied to your Ion account without asking for the shared token again

## What does the app do with the token?

LGS1920 stores the token locally and injects it into Cesium on startup.
The token never needs to be retyped on every launch once it has been saved.

## More info

If you want to learn more about Cesium Ion or create your own account, use the [Cesium Ion website](https://ion.cesium.com/){:target="_blank"}.

## Notes

- You can remove the personal token at any time and fall back to the shared token.
- The help dialog describes the feature, it does not send any request by itself.
