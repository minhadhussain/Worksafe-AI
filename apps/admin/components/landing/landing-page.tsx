"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Crosshair } from "lucide-react";

import styles from "./landing.module.css";

const PHOTO = "/industrial-workers.webp";

function SafetyLogo() {
  return (
    <svg viewBox="0 0 40 44" fill="none" aria-hidden="true">
      <path d="M20 3 36 9v12c0 10-8 16-16 20C12 37 4 31 4 21V9L20 3Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="m12 22 5 5 12-13" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 7 8 12v9c0 7 5 12 12 16" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className={styles.landing} id="overview">
      <div className={styles.backdrop} aria-hidden="true">
        <Image src={PHOTO} alt="" fill priority sizes="100vw" quality={90} className={styles.heroImage} />
        <div className={styles.imageShade} />
        <div className={styles.technicalGrid} />
        <div className={styles.ambientLight} />
        <i className={styles.particleOne} />
        <i className={styles.particleTwo} />
        <i className={styles.particleThree} />
      </div>

      <div className={styles.shell}>
        <header className={`${styles.navbar} ${styles.glass}`}>
          <Link href="/" className={styles.brand} aria-label="VIGIL OS home">
            <span className={styles.brandMark}><SafetyLogo /></span>
            <span><strong>VIGIL OS</strong><small>Industrial Safety Intelligence</small></span>
          </Link>

          <div className={styles.navActions}>
            <Link href="/admin-login" className={styles.headerLink}>Admin Login</Link>
            <Link href="/dashboard" className={`${styles.button} ${styles.navButton}`}>
              Open Dashboard <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <main id="main">
          <section className={styles.hero} aria-labelledby="hero-title">
            <div className={styles.heroContent}>
              <div className={styles.eyebrow}><span className={styles.eyebrowLine} /><span>REAL-TIME INDUSTRIAL SAFETY</span></div>
              <h1 id="hero-title">Intelligence for<br /><span>Safer Workplaces.</span></h1>
              <p className={styles.heroDescription}>Unify computer vision, worker telemetry, and machine monitoring into one real-time safety intelligence system.</p>
              <div className={styles.heroActions}>
                <Link href="/dashboard" className={`${styles.button} ${styles.primaryButton}`}>Open Dashboard <ArrowRight size={17} aria-hidden="true" /></Link>
                <Link href="/admin-login" className={`${styles.button} ${styles.secondaryButton}`}>Admin Login</Link>
              </div>
            </div>

            <div className={styles.sceneAnnotation} aria-hidden="true"><Crosshair size={15} /><span>HUMAN SAFETY. MACHINE PRECISION.</span><span className={styles.annotationLine} /></div>
          </section>
        </main>

        <footer className={styles.footer}><span className={styles.footerBrand}>VIGIL OS INTELLIGENCE</span><p>PEOPLE <span>/</span> MACHINES <span>/</span> ENVIRONMENTS <span>/</span> REAL-TIME INTELLIGENCE</p><span className={styles.footerStatus}>DESIGNED FOR WHAT MATTERS.</span></footer>
      </div>
    </div>
  );
}
