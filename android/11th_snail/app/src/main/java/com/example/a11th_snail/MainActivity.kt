package com.example.a11th_snail

import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import android.widget.Toast


class MainActivity : AppCompatActivity() {

    private lateinit var imgSelectedShell: ImageView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        imgSelectedShell = findViewById(R.id.imgSelectedShell)

        val btnShell1 = findViewById<ImageButton>(R.id.btnShell1)
        val btnShell2 = findViewById<ImageButton>(R.id.btnShell2)
        val btnShell3 = findViewById<ImageButton>(R.id.btnShell3)
        val btnShell4 = findViewById<ImageButton>(R.id.btnShell4)

        btnShell1.setOnClickListener {
            imgSelectedShell.setImageResource(R.drawable.shell1)
            imgSelectedShell.visibility = View.VISIBLE
            Toast.makeText(this, "1번은 무당벌레 껍질이에요. 다시 골라보세요!", Toast.LENGTH_SHORT).show()
        }

        btnShell2.setOnClickListener {
            imgSelectedShell.setImageResource(R.drawable.shell2)
            imgSelectedShell.visibility = View.VISIBLE
            Toast.makeText(this, "정답입니다! 2번이 달팽이 집이에요.", Toast.LENGTH_SHORT).show()
        }

        btnShell3.setOnClickListener {
            imgSelectedShell.setImageResource(R.drawable.shell3)
            imgSelectedShell.visibility = View.VISIBLE
            Toast.makeText(this, "3번은 축구공이에요. 다시 골라보세요!", Toast.LENGTH_SHORT).show()
        }

        btnShell4.setOnClickListener {
            imgSelectedShell.setImageResource(R.drawable.shell4)
            imgSelectedShell.visibility = View.VISIBLE
            Toast.makeText(this, "4번은 거북이 등껍질이에요. 다시 골라보세요!", Toast.LENGTH_SHORT).show()
        }
    }
}