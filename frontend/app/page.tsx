import Image from "next/image";
import Counter from "./components/Counter";

export default function Home() {
  return (
    <>
      <section id="center">
        <div className="hero">
          <Image
            src="/assets/hero.png"
            className="base"
            width={170}
            height={179}
            alt=""
            priority
          />
          <Image
            src="/assets/typescript.svg"
            className="framework"
            width={28}
            height={28}
            alt="TypeScript logo"
          />
          <Image
            src="/assets/next.svg"
            className="vite"
            width={26}
            height={26}
            alt="Next.js logo"
          />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>app/page.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <Counter />
      </section>

      <div className="ticks" />

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon" />
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://nextjs.org/docs" target="_blank" rel="noreferrer">
                <Image
                  className="logo"
                  src="/assets/next.svg"
                  width={18}
                  height={18}
                  alt=""
                />
                Explore Next.js
              </a>
            </li>
            <li>
              <a
                href="https://www.typescriptlang.org"
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  className="button-icon"
                  src="/assets/typescript.svg"
                  width={18}
                  height={18}
                  alt=""
                />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon" />
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Next.js community</p>
          <ul>
            <li>
              <a
                href="https://github.com/vercel/next.js"
                target="_blank"
                rel="noreferrer"
              >
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon" />
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a
                href="https://discord.gg/nextjs"
                target="_blank"
                rel="noreferrer"
              >
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon" />
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a
                href="https://x.com/nextjs"
                target="_blank"
                rel="noreferrer"
              >
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon" />
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a
                href="https://bsky.app/profile/nextjs.org"
                target="_blank"
                rel="noreferrer"
              >
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon" />
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks" />
      <section id="spacer" />
    </>
  );
}
