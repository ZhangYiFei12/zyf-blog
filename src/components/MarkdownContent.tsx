import ReactMarkdown from "react-markdown";

export function MarkdownContent({ content }: { content: string }) {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}