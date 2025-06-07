import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import rehypeRaw from "rehype-raw";
import { ExternalLink, Phone, Mail, Download } from "lucide-react";

// Define proper interfaces for component props
interface MarkdownProps {
  content: string;
  id: string;
}

// Extend the CodeProps interface to include the properties we need
interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// Interfaces for other element props
interface ElementProps {
  children?: React.ReactNode;
}

interface LinkProps extends ElementProps {
  href?: string;
}

// Helper function to determine link type and add appropriate icons
const getLinkIcon = (href: string = "") => {
  if (href.startsWith("tel:"))
    return <Phone size={12} className="inline ml-1" />;
  if (href.startsWith("mailto:"))
    return <Mail size={12} className="inline ml-1" />;
  if (href.includes("play.google.com") || href.includes(".apk"))
    return <Download size={12} className="inline ml-1" />;
  return <ExternalLink size={12} className="inline ml-1" />;
};

// Helper function to get appropriate styling for different link types
const getLinkStyling = (href: string = "") => {
  if (href.startsWith("tel:"))
    return "text-green-600 hover:text-green-800 hover:underline font-medium";
  if (href.startsWith("mailto:"))
    return "text-blue-600 hover:text-blue-800 hover:underline font-medium";
  if (href.includes("play.google.com"))
    return "text-purple-600 hover:text-purple-800 hover:underline font-medium";
  if (href.includes("mobikwik.com") || href.includes("payment"))
    return "text-orange-600 hover:text-orange-800 hover:underline font-medium bg-orange-50 px-2 py-1 rounded";
  if (href.includes("kolhapurcorporation.gov.in"))
    return "text-blue-700 hover:text-blue-900 hover:underline font-medium bg-blue-50 px-2 py-1 rounded";
  return "text-blue-600 hover:text-blue-800 hover:underline font-medium";
};

export const MemoizedMarkdown = memo(({ content, id }: MarkdownProps) => {
  return (
    <div className="h-fit flex flex-col gap-2 text-sm leading-relaxed" id={id}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code: ({ inline, className, children, ...props }: CodeProps) => {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                className="rounded-lg text-xs"
                {...props}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-gray-100 px-2 py-1 rounded text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          table: ({ children, ...props }: ElementProps) => {
            return (
              <div className="overflow-x-auto my-2">
                <table
                  className="border-collapse border border-gray-300 w-full text-xs"
                  {...props}
                >
                  {children}
                </table>
              </div>
            );
          },
          th: ({ children, ...props }: ElementProps) => {
            return (
              <th
                className="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold text-left"
                {...props}
              >
                {children}
              </th>
            );
          },
          td: ({ children, ...props }: ElementProps) => {
            return (
              <td className="border border-gray-300 px-3 py-2" {...props}>
                {children}
              </td>
            );
          },
          a: ({ children, href, ...props }: LinkProps) => {
            const linkStyling = getLinkStyling(href);
            const icon = getLinkIcon(href);

            return (
              <a
                href={href}
                className={`${linkStyling} transition-colors duration-200 inline-flex items-center`}
                target={href?.startsWith("http") ? "_blank" : "_self"}
                rel={
                  href?.startsWith("http") ? "noopener noreferrer" : undefined
                }
                {...props}
              >
                {children}
                {icon}
              </a>
            );
          },
          ul: ({ children, ...props }: ElementProps) => {
            return (
              <ul className="list-disc pl-5 space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol: ({ children, ...props }: ElementProps) => {
            return (
              <ol className="list-decimal pl-5 space-y-1" {...props}>
                {children}
              </ol>
            );
          },
          blockquote: ({ children, ...props }: ElementProps) => {
            return (
              <blockquote
                className="border-l-4 border-blue-300 pl-4 italic bg-blue-50 py-2 rounded-r"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          // Enhanced heading components with better hierarchy
          h1: ({ children, ...props }: ElementProps) => (
            <h1
              className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-1 mb-2"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }: ElementProps) => (
            <h2 className="text-base font-bold text-gray-800 mb-2" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }: ElementProps) => (
            <h3 className="text-sm font-bold text-gray-700 mb-1" {...props}>
              {children}
            </h3>
          ),
          h4: ({ children, ...props }: ElementProps) => (
            <h4 className="text-sm font-semibold text-gray-700 mb-1" {...props}>
              {children}
            </h4>
          ),
          // Enhanced paragraph with better spacing
          p: ({ children, ...props }: ElementProps) => (
            <p className="mb-2 text-gray-700 leading-relaxed" {...props}>
              {children}
            </p>
          ),
          // Enhanced list items with better spacing
          li: ({ children, ...props }: ElementProps) => (
            <li className="text-gray-700" {...props}>
              <div className="flex flex-col gap-1">{children}</div>
            </li>
          ),
          // Enhanced strong/bold text
          strong: ({ children, ...props }: ElementProps) => (
            <strong className="font-semibold text-gray-800" {...props}>
              {children}
            </strong>
          ),
          // Enhanced emphasis/italic text
          em: ({ children, ...props }: ElementProps) => (
            <em className="italic text-gray-600" {...props}>
              {children}
            </em>
          ),
          // Enhanced horizontal rule
          hr: ({ ...props }) => (
            <hr className="border-gray-300 my-3" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MemoizedMarkdown.displayName = "MemoizedMarkdown";
