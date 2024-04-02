import { Icons } from "@/components/icons";
import { Typography } from "@/components/typography";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button, buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  getEpisodeInfo as getEpInfo,
  getEpisodeSources,
} from "@/lib/dramacool";
import { episodeSourceSchema } from "@/lib/validations";
import { notify } from "@/lib/webhooks/slack";
import type { Metadata, ResolvingMetadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, cache } from "react";
import UpdateWatchlistButton from "./update-progress";

interface PageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  try {
    const episodeInfo = await getEpisodeInfo(params.slug);
    if (!episodeInfo) throw new Error("Episode info not found!");
    const title = `${episodeInfo.title} | Episode ${episodeInfo.number}`;
    const ogImage = `https://og.rohi.dev/general?title=${title}&textColor=fff&backgroundColorHex=000`;
    return {
      title,
      description: `Watch episode ${episodeInfo.number} of ${
        episodeInfo.title
      }. ${(await parent).description}`,
      openGraph: {
        images: [ogImage],
      },
    };
  } catch (error) {
    const { title, description } = await parent;
    return {
      title,
      description,
    };
  }
}

const VideoPlayer = dynamic(() => import("@/components/react-player"), {
  ssr: false,
});

const getEpisodeInfo = cache(async (episodeSlug: string) => {
  const episodeInfo = await getEpInfo(episodeSlug);
  if (!episodeInfo) throw new Error("Episode info not found!");
  return episodeInfo;
});

const cachedAuth = cache(async () => {
  return await auth();
});

export default async function Page({ params }: PageProps) {
  const { dramaId, title, number } = await getEpisodeInfo(params.slug);
  const text = `Someone is watching at ${title} episode ${number}`;
  notify(text);
  return (
    <section className="mx-auto space-y-4 px-4 py-4 lg:container lg:py-10">
      <Suspense>
        <Notify text={text} />
      </Suspense>
      <Link
        href={`/drama/${dramaId.split("/")[1]}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        View Drama Series
      </Link>
      <Vid episodeSlug={params.slug} number={number} dramaId={dramaId} />
      <ControlButtons episodeSlug={params.slug} />
      <Typography as={"h1"} variant={"h2"} className="mb-2 border-b">
        {title} | Episode {number}
      </Typography>
    </section>
  );
}

async function ControlButtons({ episodeSlug }: { episodeSlug: string }) {
  const { episodes, number, downloadLink, dramaId } =
    await getEpisodeInfo(episodeSlug);
  const session = await cachedAuth();
  let watched = false;
  if (session) {
    const watchListData = await db.query.watchList.findFirst({
      where: (table, { eq, and, gte }) =>
        and(
          gte(table.episode, number),
          eq(table.dramaId, dramaId),
          eq(table.userId, session?.user.id),
        ),
    });
    watched = !!watchListData;
  }
  const dramaInfo = await db.query.series.findFirst({
    where: (table, { eq }) => eq(table.slug, dramaId),
  });
  return (
    <div className="flex flex-wrap gap-1">
      <Button size={"sm"} disabled={!episodes.previous}>
        <Link
          href={`/watch/${episodes.previous}`}
          scroll={false}
          className="flex items-center justify-center gap-2"
        >
          <Icons.arrowLeft className="size-4" /> Previous
        </Link>
      </Button>
      <Button
        size={"sm"}
        variant={"outline"}
        className="flex items-center justify-start gap-2"
      >
        <Icons.tv className="size-4" /> {number}
      </Button>
      <Button size={"sm"} disabled={!episodes.next}>
        <Link
          href={`/watch/${episodes.next}`}
          scroll={false}
          className="flex items-center justify-center gap-2"
        >
          Next <Icons.arrowRight className="size-4" />
        </Link>
      </Button>
      <Button size={"sm"} variant={"secondary"}>
        <Link
          href={downloadLink}
          download
          className="flex items-center justify-center gap-2"
        >
          <Icons.arrowLeft className="-rotate-90 size-4" />
          Download
        </Link>
      </Button>
      {!!session && !!dramaInfo && (
        <UpdateWatchlistButton
          size="sm"
          episode={number}
          slug={dramaId}
          watched={watched}
        />
      )}
    </div>
  );
}

type Props = { episodeSlug: string; number: number; dramaId: string };

async function Vid({ episodeSlug, dramaId, number }: Props) {
  const episodeSources = await getEpisodeSources(episodeSlug);
  const session = await cachedAuth();
  let seekTo: number | undefined = undefined;
  if (session) {
    const progress = await db.query.progress.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.episodeSlug, episodeSlug),
          eq(table.userId, session.user.id),
        ),
    });
    seekTo = progress ? Number(progress.seconds) : undefined;
  }

  const parsed = episodeSourceSchema.parse(episodeSources);
  const props = {
    slug: episodeSlug,
    dramaId,
    number,
    seekTo,
    url: parsed.sources[0].url,
  };

  return (
    <div className="lg:h-1/2">
      <AspectRatio ratio={16 / 9}>
        <VideoPlayer {...props} />
      </AspectRatio>
    </div>
  );
}

const cacheNotify = cache(notify);

async function Notify({ text }: { text: string }) {
  await cacheNotify(text);
  return <></>;
}
