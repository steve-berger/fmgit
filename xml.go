package main

import (
	"bytes"
	"encoding/binary"
	"encoding/xml"
	"errors"
	"io"
	"strings"
	"unicode/utf16"
)

// Node is a minimal ordered XML element. FileMaker's XML has no namespaces
// and no mixed content, so name/attrs/kids/text is all we need.
type Node struct {
	Name string
	Attr []xml.Attr
	Kids []*Node
	Text string
}

func (n *Node) Get(k string) string {
	for _, a := range n.Attr {
		if a.Name.Local == k {
			return a.Value
		}
	}
	return ""
}

func (n *Node) Has(k string) bool {
	for _, a := range n.Attr {
		if a.Name.Local == k {
			return true
		}
	}
	return false
}

func (n *Node) Set(k, v string) {
	for i := range n.Attr {
		if n.Attr[i].Name.Local == k {
			n.Attr[i].Value = v
			return
		}
	}
	n.Attr = append(n.Attr, xml.Attr{Name: xml.Name{Local: k}, Value: v})
}

func (n *Node) Del(k string) {
	out := n.Attr[:0]
	for _, a := range n.Attr {
		if a.Name.Local != k {
			out = append(out, a)
		}
	}
	n.Attr = out
}

func (n *Node) Child(name string) *Node {
	for _, k := range n.Kids {
		if k.Name == name {
			return k
		}
	}
	return nil
}

// Walk visits n and its descendants depth-first; returning false skips the kids.
func (n *Node) Walk(f func(*Node) bool) {
	if f(n) {
		for _, k := range n.Kids {
			k.Walk(f)
		}
	}
}

func (n *Node) Clone() *Node {
	c := &Node{Name: n.Name, Text: n.Text, Attr: append([]xml.Attr(nil), n.Attr...)}
	for _, k := range n.Kids {
		c.Kids = append(c.Kids, k.Clone())
	}
	return c
}

// ParseXML reads UTF-8 or UTF-16 (FileMaker exports UTF-16) XML.
func ParseXML(data []byte) (*Node, error) {
	d := xml.NewDecoder(bytes.NewReader(toUTF8(data)))
	d.CharsetReader = func(_ string, r io.Reader) (io.Reader, error) { return r, nil } // already UTF-8
	var stack []*Node
	var root *Node
	for {
		tok, err := d.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			n := &Node{Name: t.Name.Local}
			for _, a := range t.Attr {
				n.Attr = append(n.Attr, xml.Attr{Name: xml.Name{Local: a.Name.Local}, Value: a.Value})
			}
			if len(stack) > 0 {
				p := stack[len(stack)-1]
				p.Kids = append(p.Kids, n)
			} else if root == nil {
				root = n
			} else {
				return nil, errors.New("more than one root element")
			}
			stack = append(stack, n)
		case xml.EndElement:
			n := stack[len(stack)-1]
			if len(n.Kids) > 0 && strings.TrimSpace(n.Text) == "" {
				n.Text = "" // indentation
			}
			stack = stack[:len(stack)-1]
		case xml.CharData:
			if len(stack) > 0 {
				stack[len(stack)-1].Text += string(t)
			}
		}
	}
	if root == nil {
		return nil, errors.New("no root element")
	}
	return root, nil
}

func toUTF8(b []byte) []byte {
	switch {
	case bytes.HasPrefix(b, []byte{0xEF, 0xBB, 0xBF}):
		return b[3:]
	case bytes.HasPrefix(b, []byte{0xFF, 0xFE}):
		return decode16(b[2:], binary.LittleEndian)
	case bytes.HasPrefix(b, []byte{0xFE, 0xFF}):
		return decode16(b[2:], binary.BigEndian)
	}
	return b
}

func decode16(b []byte, bo binary.ByteOrder) []byte {
	u := make([]uint16, len(b)/2)
	for i := range u {
		u[i] = bo.Uint16(b[2*i:])
	}
	return []byte(string(utf16.Decode(u)))
}

// XML serializes n as a UTF-8 document, one element per line, so line diffs
// map to FileMaker changes.
func (n *Node) XML() []byte {
	var b bytes.Buffer
	b.WriteString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
	n.write(&b, 0)
	return b.Bytes()
}

var (
	attrEsc = strings.NewReplacer("&", "&amp;", "<", "&lt;", `"`, "&quot;", "\t", "&#9;", "\n", "&#10;", "\r", "&#13;")
	textEsc = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\r", "&#13;")
)

func (n *Node) write(b *bytes.Buffer, depth int) {
	ind := strings.Repeat("\t", depth)
	b.WriteString(ind + "<" + n.Name)
	for _, a := range n.Attr {
		b.WriteString(" " + a.Name.Local + `="` + attrEsc.Replace(a.Value) + `"`)
	}
	switch {
	case len(n.Kids) > 0:
		b.WriteString(">\n")
		if n.Text != "" {
			b.WriteString(ind + "\t" + textOut(n.Text) + "\n")
		}
		for _, k := range n.Kids {
			k.write(b, depth+1)
		}
		b.WriteString(ind + "</" + n.Name + ">\n")
	case n.Text != "":
		b.WriteString(">" + textOut(n.Text) + "</" + n.Name + ">\n")
	default:
		b.WriteString("/>\n")
	}
}

// textOut keeps calculations readable: CDATA instead of &amp;-soup where possible.
func textOut(s string) string {
	if strings.ContainsAny(s, "&<>") && !strings.Contains(s, "]]>") && !strings.Contains(s, "\r") {
		return "<![CDATA[" + s + "]]>"
	}
	return textEsc.Replace(s)
}
