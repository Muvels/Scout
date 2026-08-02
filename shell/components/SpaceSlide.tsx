import { Component, type ReactNode } from 'react';
import { cn } from '../lib/utils.js';

type SpaceSlideProps = {
  /** Identity of the shown space; a change triggers the slide. */
  slideKey: string;
  /** The space's position in the strip; the change's sign picks the side. */
  index: number;
  className?: string;
  children: ReactNode;
};

/** The outgoing layer's clone plus what cloneNode(true) doesn't carry. */
type Snapshot = {
  ghost: HTMLElement;
  scrollTops: number[];
  forward: boolean;
} | null;

const DURATION = 320;
// Expo-style ease-out: the belt leaves with the flick's energy and settles
// softly. Both layers share the one curve so their seam never drifts.
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

/*
 * Slides its content sideways when the active space changes, Arc-style:
 * the outgoing space's rows exit toward one edge while the incoming rows
 * enter from the other, in space-strip order.
 *
 * Only the active space's rows are ever mounted, so the outgoing layer is
 * a DOM clone taken in getSnapshotBeforeUpdate — the one lifecycle that
 * still sees the old rows after render but before React commits the new
 * ones, and the reason this is a class component: hooks have no pre-commit
 * read. Both layers animate through WAAPI rather than CSS classes so the
 * SDK's document-wide animation watchers never wake — WAAPI fires no
 * animationstart/transitionrun events.
 */
export class SpaceSlide extends Component<SpaceSlideProps, unknown, Snapshot> {
  private content: HTMLDivElement | null = null;
  private ghost: HTMLElement | undefined;
  private animations: Animation[] = [];

  getSnapshotBeforeUpdate(prev: Readonly<SpaceSlideProps>): Snapshot {
    if (
      prev.slideKey === this.props.slideKey
      || prev.index < 0
      || this.props.index < 0
      || this.content === null
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return null;
    }
    return {
      ghost: this.content.cloneNode(true) as HTMLElement,
      // Scroll offsets don't survive cloneNode; reapply them by position.
      scrollTops: Array.from(
        this.content.querySelectorAll('.scout-scroll-area'),
        (area) => area.scrollTop,
      ),
      // A same-index change (the active space was removed) exits forward.
      forward: this.props.index >= prev.index,
    };
  }

  componentDidUpdate(
    _prev: Readonly<SpaceSlideProps>,
    _state: unknown,
    snapshot?: Snapshot,
  ): void {
    if (!snapshot || this.content === null) return;
    this.settle();
    const { ghost, scrollTops, forward } = snapshot;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.position = 'absolute';
    ghost.style.inset = '0';
    ghost.style.pointerEvents = 'none';
    this.content.parentElement?.appendChild(ghost);
    ghost.querySelectorAll('.scout-scroll-area').forEach((area, i) => {
      area.scrollTop = scrollTops[i] ?? 0;
    });
    const exit = ghost.animate(
      { transform: ['translateX(0)', `translateX(${forward ? -100 : 100}%)`] },
      { duration: DURATION, easing: EASING, fill: 'forwards' },
    );
    const enter = this.content.animate(
      { transform: [`translateX(${forward ? 100 : -100}%)`, 'translateX(0)'] },
      { duration: DURATION, easing: EASING },
    );
    exit.onfinish = () => this.settle();
    this.ghost = ghost;
    this.animations = [exit, enter];
  }

  componentWillUnmount(): void {
    this.settle();
  }

  /** Drops the outgoing layer and stops any in-flight slide. */
  private settle(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
    this.ghost?.remove();
    this.ghost = undefined;
  }

  render(): ReactNode {
    return (
      <div className={cn('relative overflow-hidden', this.props.className)}>
        <div
          ref={(node) => {
            this.content = node;
          }}
          className="h-full"
        >
          {this.props.children}
        </div>
      </div>
    );
  }
}
