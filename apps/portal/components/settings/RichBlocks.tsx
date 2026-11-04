import React from 'react';
import type { RichBlock, RichInline, RichListBlock } from '@/lib/medusa';

// Draws the blocks the server made from a support page's text. The server has
// already removed everything unsafe: links are https, mailto: or tel: only.

function Inline({ nodes }: { nodes: RichInline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === 'break') return <br key={index} />;
        if (node.type === 'link') {
          const web = /^https?:/i.test(node.href);
          return (
            <a
              key={index}
              href={node.href}
              {...(web ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}
            >
              {node.children.map((child, i) => (
                <TextPiece key={i} node={child} />
              ))}
            </a>
          );
        }
        return <TextPiece key={index} node={node} />;
      })}
    </>
  );
}

function TextPiece({ node }: { node: { text: string; bold?: boolean; italic?: boolean } }) {
  let out: React.ReactNode = node.text;
  if (node.italic) out = <em>{out}</em>;
  if (node.bold) out = <strong>{out}</strong>;
  return <>{out}</>;
}

const LIST_STYLES = ['disc', 'circle', 'square', 'square'];

function List({ list, depth }: { list: RichListBlock; depth: number }) {
  const Tag = list.ordered ? 'ol' : 'ul';
  return (
    <Tag
      style={{
        margin: depth === 0 ? '0 0 12px' : '4px 0 0',
        paddingLeft: '22px',
        listStyleType: list.ordered ? 'decimal' : LIST_STYLES[Math.min(depth, 3)],
      }}
    >
      {list.items.map((item, index) => (
        <li key={index} style={{ margin: '4px 0' }}>
          <Inline nodes={item.content} />
          {item.children.map((child, i) => (
            <List key={i} list={child} depth={depth + 1} />
          ))}
        </li>
      ))}
    </Tag>
  );
}

const HEADING_STYLES: Record<number, React.CSSProperties> = {
  1: { fontSize: '22px', fontWeight: 700, margin: '4px 0 12px' },
  2: { fontSize: '18px', fontWeight: 600, margin: '18px 0 8px' },
  3: { fontSize: '16px', fontWeight: 600, margin: '14px 0 6px' },
};

export function RichBlocks({ blocks }: { blocks: RichBlock[] }) {
  return (
    <div data-testid="rich-preview" style={{ fontSize: '14px', lineHeight: 1.7, color: '#1F2937' }}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <div key={index} role="heading" aria-level={block.level + 1} style={HEADING_STYLES[block.level]}>
              <Inline nodes={block.content} />
            </div>
          );
        }
        if (block.type === 'paragraph') {
          return (
            <p key={index} style={{ margin: '0 0 12px' }}>
              <Inline nodes={block.content} />
            </p>
          );
        }
        if (block.type === 'rule') {
          return <hr key={index} style={{ border: 0, borderTop: '1px solid #E6E8EC', margin: '16px 0' }} />;
        }
        return <List key={index} list={block} depth={0} />;
      })}
    </div>
  );
}
