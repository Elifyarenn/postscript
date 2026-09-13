"use client";

import { useEffect } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-ui",
});

const REVEAL_SELECTOR = [
  ".ps-home .hero-copy",
  ".ps-home .hero-categories",
  ".ps-home .section-title",
  ".ps-home .view-all",
  ".ps-home .card",
  ".ps-home .feature-block",
  ".ps-home .footer-logo",
  ".ps-home .footer-links",
  ".ps-home .footer-social",
].join(", ");

/** The public homepage, shown to anonymous visitors at the site root. */
export function HomePage() {
  useEffect(() => {
    const revealables = Array.from(document.querySelectorAll(REVEAL_SELECTOR));
    revealables.forEach((element) => element.classList.add("reveal"));

    if (!("IntersectionObserver" in window)) {
      revealables.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    revealables.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`ps-home ${cormorant.variable} ${inter.variable}`}>
      <header className="site-header">
        <div className="topbar">
          <nav className="topbar-links" aria-label="Üst bağlantılar">
            <a href="#latest">BÜLTEN!</a>
            <a href="#hero">HOŞ GELDİN</a>
          </nav>
          <div className="topbar-actions">
            <a className="btn btn-ghost" href="/login">
              GİRİŞ YAP
            </a>
            <a className="btn btn-solid" href="/register">
              HEMEN KATIL
            </a>
          </div>
        </div>

        <div className="brand">
          <h1 className="logo">
            POSTSCRIPT DERGİ<span className="logo-pipe">|</span>
          </h1>
          <p className="tagline">Bırakamadıklarımız üzerine</p>
        </div>

        <nav className="main-nav" aria-label="Ana menü">
          <a href="#hero">ANA SAYFA</a>
          <a href="#categories">KATEGORİLER</a>
          <a href="#about">HAKKINDA</a>
          <a href="#latest">SAYILAR</a>
          <a href="#community">TOPLULUK</a>
          <a href="/iletisim">İLETİŞİM</a>
          <button className="search-btn" aria-label="Ara" title="Ara">
            🔍
          </button>
        </nav>
      </header>

      <section className="hero" id="hero">
        <div className="hero-inner" id="about">
          <div className="hero-copy">
            <p className="issue">SAYI 01</p>
            <h2 className="hero-title">OBSESSION</h2>
            <a className="read-now" href="/magazine">
              HEMEN OKU!
            </a>
          </div>

          <ul className="hero-categories" id="categories">
            <li>PSİKOLOJİ</li>
            <li>KÜLTÜR</li>
            <li>İLİŞKİLER</li>
            <li>BİLİM &amp; TEKNOLOJİ</li>
            <li>SANAT &amp; EDEBİYAT</li>
          </ul>
        </div>
      </section>

      <section className="latest" id="latest">
        <div className="section-head">
          <h2 className="section-title">SON YAZILAR</h2>
          <a className="view-all" href="#latest">
            TÜMÜNÜ GÖR →
          </a>
        </div>

        <div className="cards">
          <article className="card">
            <div className="card-art"></div>
            <span className="card-tag">Sanat &amp; Edebiyat</span>
            <h3 className="card-title">Sakladığımız Sessiz Odalar</h3>
          </article>
          <article className="card">
            <div className="card-art"></div>
            <span className="card-tag">Bilim &amp; Teknoloji</span>
            <h3 className="card-title">Algoritma ve Ruh</h3>
          </article>
          <article className="card">
            <div className="card-art"></div>
            <span className="card-tag">Psikoloji</span>
            <h3 className="card-title">Yavaşça Bırakmak Üzerine</h3>
          </article>
          <article className="card">
            <div className="card-art"></div>
            <span className="card-tag">İlişkiler</span>
            <h3 className="card-title">Hiç Gönderilmemiş Mektuplar</h3>
          </article>
        </div>
      </section>

      <section className="blocks" id="community">
        <div className="feature-block">
          <p className="feature-label">OBSESYON SERİSİ</p>
        </div>
        <div className="feature-block">
          <p className="feature-label">TOPLULUK SESLERİ</p>
        </div>
      </section>

      <footer className="site-footer" id="contact">
        <div className="footer-logo">
          postscript<span className="logo-pipe">|</span>
        </div>

        {/* 5651 s. 3 wants these reachable from the front page, so they are real
            links rather than anchors back into this footer (D-084) */}
        <nav className="footer-links" aria-label="Yasal bağlantılar">
          <a href="/kullanim-sartlari">kullanım şartları</a>
          <a href="/kvkk">gizlilik</a>
          <a href="/iletisim">künye ve iletişim</a>
        </nav>

        <div className="footer-social">
          <p className="friends">arkadaş olalım!</p>
          <div className="social-icons">
            <a href="#" aria-label="X" title="X">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zM17.083 19.07h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="#" aria-label="TikTok" title="TikTok">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
              </svg>
            </a>
            <a href="#" aria-label="LinkedIn" title="LinkedIn">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a href="#" aria-label="Instagram" title="Instagram">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
            <a href="#" aria-label="Pinterest" title="Pinterest">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>

        <p className="credit">
          Designed by{" "}
          <a href="https://www.elifyarencekic.com/" target="_blank" rel="noopener noreferrer">
            Elif Yaren Çekiç &amp; Tuanna Demir
          </a>
        </p>
      </footer>
    </div>
  );
}