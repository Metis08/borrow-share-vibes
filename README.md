# The Mohalla Exchange

IMPORTANT — NO CONVENTIONAL NAVBAR

Do NOT create a traditional navbar.

No rectangular navigation bar.

No header container.

No hamburger menu.

No boxed buttons across the top.

No SaaS-style navigation.

Study the provided Deluxe Salon reference carefully.

The website should feel like the interface is part of the artwork itself.

At the very top of the hero image, place small pieces of floating text directly over the image.

TOP LEFT:

A tiny handwritten / monospaced text showing the current time.

Example:

4:37 PM

Under or near it:

●  32 people online

This should feel like a little status annotation on the photograph.

TOP RIGHT:

Place very minimal text links directly over the image:

EXPLORE

MY PROFILE

These should be plain text only.

No background.

No rectangle.

No pill.

No border.

On hover, the text can slightly brighten, shift, or underline with a tiny hand-drawn animation.

MOST IMPORTANT:

Place the BORROWER / LENDER mode switch in the TOP RIGHT as plain typography.

For example:

BORROWER   ·   LENDER

The currently active mode should have a tiny handwritten underline or small dot beside it.

Example:

BORROWER  ●   LENDER

Do NOT put this inside a rounded rectangle.

It should look like editorial text printed over the image.

When switching modes, animate the small dot moving from one word to the other.

The entire top interface should occupy very little visual space.

The IMAGE is the hero.

The UI is secondary.

--------------------------------------------------

HERO TEXT

Do NOT place a giant website title in the middle like a normal landing page.

The physical shop sign in the supplied image already says:

मोहल्ला स्टोर

That is the logo/title.

Let the photograph do the branding.

Underneath / near the storefront, optionally place a very small English tagline:

BORROW IT. RETURN IT. KEEP THE MOHALLA MOVING.

Keep it subtle.

No giant centered HTML heading.

--------------------------------------------------

FLOATING UI DETAILS

Take inspiration from the Deluxe Salon reference.

The hero can contain tiny floating interface elements that feel like they naturally belong to the scene.

Examples:

● 32 people online

OPEN TODAY

NEARBY: 18 LENDERS

or:

THE MOHALLA IS AWAKE

These should look like little pieces of typography floating over the photograph.

Some can have tiny icons, but avoid UI boxes.

--------------------------------------------------

MODE SWITCH

The mode switch should feel almost like a handwritten annotation.

Example:

BORROWER · LENDER

When BORROWER is active:

BORROWER  ●  LENDER

When LENDER is active:

BORROWER  ●  LENDER

Move the dot smoothly between the two.

The text itself should remain plain.

No pill-shaped container.

No border.

No background.

--------------------------------------------------

SCROLL TRANSITION

The hero should behave almost like a poster / photograph.

As the user scrolls:

the photograph remains fixed/sticky for a moment.

Then a large dark translucent glass layer rises FROM THE BOTTOM.

This layer should feel like a physical sheet of paper / shop counter / dark glass panel sliding over the photograph.

This is where the actual website content begins.

The top navigation should NOT suddenly appear.

The interface should emerge naturally from the image.

The transition should feel similar to the Deluxe Salon reference where the dark brown content section visually grows over the hero image.

For Mohalla Store, use a VERY DARK bluish-black glass surface instead of brown.

The photograph should remain visible behind it initially.

Use:

backdrop-filter: blur()

dark transparency

subtle blue tint

soft grain

very subtle border

large rounded top corners

The effect should feel cinematic rather than like a modal.

--------------------------------------------------

BORROWER MODE CONTENT

When the borrower mode is active, the glass layer begins with a tiny handwritten line:

18 people within 5 km are lending stuff rn 👀

Then a much larger handwritten/editorial heading:

WHAT ARE YOU SEARCHING FOR?

Under it:

“be specific. or don't.”

On the RIGHT:

a large minimal search field.

Again:

NO rectangular search-card UI.

The search input should feel like a handwritten search strip / editorial field.

Example placeholder:

projector for saturday...?

As the user types, results should emerge underneath in an unconventional layout.

--------------------------------------------------

LENDER MODE CONTENT

When lender mode is active, the same glass transition occurs.

But the content changes.

Small handwritten text:

your stuff could be doing more than collecting dust.

Large heading:

WHAT'S SITTING AROUND?

Then:

GO TO YOUR LENDING PROFILE →

Again, this should be plain typography rather than a button inside a rectangle.

Below this, introduce the lender's active items as a physical-looking shelf / scattered inventory rather than cards.

--------------------------------------------------

GENERAL UI RULE

The entire website should follow this principle:

IF A UI ELEMENT CAN BE PLAIN TEXT,

MAKE IT PLAIN TEXT.

IF IT CAN FEEL LIKE PART OF THE PHOTOGRAPH,

MAKE IT FEEL LIKE PART OF THE PHOTOGRAPH.

IF IT CAN BE AN OBJECT,

DON'T TURN IT INTO A CARD.

Avoid the visual language of:

Stripe

Linear

Notion

Shopify

generic SaaS dashboards

Instead take inspiration from:

Deluxe Salon

editorial websites

music players

old neighbourhood shop signage

physical receipts

handwritten notes

street posters

photographic interfaces

The website should feel designed, not assembled. make it in react only no typescript and do not change the attached image even a bit it is for the landing page

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5abaee58-a772-42c3-9a55-9da100b8e0f8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
