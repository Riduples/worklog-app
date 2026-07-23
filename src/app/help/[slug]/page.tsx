import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticleView } from "@/components/help/HelpArticleView";
import { HELP_ARTICLES } from "@/lib/help/content";

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = HELP_ARTICLES.find((a) => a.slug === slug);
  if (!article) return { title: "Help — Worklog" };
  return { title: `${article.title} — Worklog Help`, description: article.summary };
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = HELP_ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();
  return <HelpArticleView article={article} allArticles={HELP_ARTICLES} />;
}
